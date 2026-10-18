import { db, schema } from "@pocket-dimension/db";
import { and, eq, isNull } from "drizzle-orm";
import { error } from "@sveltejs/kit";
import { decryptToken, encryptToken } from "./tokens";
import { tryRefreshYouTubeAccessToken } from "./oauth";

const DATA_API_URL = "https://www.googleapis.com/youtube/v3";

export type ZapYouTubePlaylist = {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  itemCount: number | null;
};

export type ZapYouTubePlaylistItem = {
  videoId: string;
  title: string;
  description: string | null;
  channelTitle: string | null;
  channelId: string | null;
  /** Zero-based playlist position from YouTube when present. */
  position: number | null;
  /** When the item was added to the playlist (`snippet.publishedAt`). */
  addedAt: string | null;
  /** When the video was published (`contentDetails.videoPublishedAt`). */
  videoPublishedAt: string | null;
  durationMs: number | null;
  url: string;
};

function durationToMs(duration: string | undefined) {
  if (!duration) return null;
  const match = duration.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return null;
  const [, days = "0", hours = "0", minutes = "0", seconds = "0"] = match;
  return Number(days) * 86400000 + Number(hours) * 3600000 + Number(minutes) * 60000 + Number(seconds) * 1000;
}

const HTML_NAMED_ENTITIES: Record<string, string> = {
  quot: '"',
  amp: "&",
  lt: "<",
  gt: ">",
  apos: "'",
  nbsp: " ",
};

function decodeHtmlEntities(value: string): string {
  return value.replace(/&(#(?:x[0-9a-fA-F]+|\d+)|[a-zA-Z]+);/g, (match, entity: string) => {
    if (entity[0] === "#") {
      const code = entity[1] === "x" || entity[1] === "X" ? Number.parseInt(entity.slice(2), 16) : Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return HTML_NAMED_ENTITIES[entity] ?? match;
  });
}

function youtubeText(value: string | null | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed ? decodeHtmlEntities(trimmed) : fallback;
}

function bestThumbnail(thumbnails: unknown) {
  if (!thumbnails || typeof thumbnails !== "object") return null;
  const values = Object.values(thumbnails as Record<string, { url?: string; width?: number }>);
  return values.sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0]?.url ?? null;
}

const youtubeLinks = () => schema.zapYoutubeAccountLinks;

/** Prefer select() over db.query — relational API can miss tables when shared/db dist is stale or Vite SSR duplicates drizzle. */
async function findActiveYoutubeLink(userId: string) {
  const table = youtubeLinks();
  if (!table) return null;
  const [link] = await db
    .select()
    .from(table)
    .where(and(eq(table.userId, userId), isNull(table.revokedAt)))
    .limit(1);
  return link ?? null;
}

export async function getYouTubeAccessTokenForUser(userId: string) {
  try {
    const link = await findActiveYoutubeLink(userId);
    if (!link) return null;

    if (link.accessExpiresAt.getTime() > Date.now() + 60_000) {
      return decryptToken(link.accessTokenEnc);
    }

    const refreshToken = decryptToken(link.refreshTokenEnc);
    const refreshed = await tryRefreshYouTubeAccessToken(refreshToken);
    if (!refreshed) return null;

    const table = youtubeLinks();
    await db
      .update(table)
      .set({
        accessTokenEnc: encryptToken(refreshed.accessToken),
        accessExpiresAt: refreshed.accessExpiresAt,
        scopes: refreshed.scopes,
        revokedAt: null,
      })
      .where(eq(table.userId, userId));

    return refreshed.accessToken;
  } catch (err) {
    console.error("[zap youtube] access token lookup failed", { userId }, err);
    return null;
  }
}

export async function requireYouTubeAccessTokenForUser(userId: string) {
  const accessToken = await getYouTubeAccessTokenForUser(userId);
  if (!accessToken) throw error(403, "YouTube account is not linked");
  return accessToken;
}

async function youtubeFetch<T>(
  path: string,
  params: Record<string, string>,
  auth: { accessToken?: string; requireUserAuth?: boolean } = {}
): Promise<T> {
  const url = new URL(`${DATA_API_URL}/${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const headers: HeadersInit = {};
  const apiKey = Bun.env.YOUTUBE_DATA_API_KEY?.trim();
  if (auth.requireUserAuth && auth.accessToken) {
    headers.Authorization = `Bearer ${auth.accessToken}`;
  } else if (apiKey) {
    url.searchParams.set("key", apiKey);
  } else if (auth.accessToken) {
    headers.Authorization = `Bearer ${auth.accessToken}`;
  } else {
    throw error(503, "YouTube Data API credentials are not configured");
  }

  const response = await fetch(url, { headers });
  const body = (await response.json().catch(() => ({}))) as T & {
    error?: { message?: string; errors?: Array<{ reason?: string }> };
  };
  if (!response.ok) {
    console.error("[zap youtube] Data API request failed", {
      path,
      status: response.status,
      reason: body.error?.errors?.[0]?.reason,
      message: body.error?.message,
    });
    throw error(response.status, body.error?.message ?? "YouTube Data API request failed");
  }
  return body;
}

export async function getYoutubeLinkStatus(userId: string) {
  try {
    const link = await findActiveYoutubeLink(userId);
    if (!link) return { linked: false as const };
    return {
      linked: true as const,
      linkedAt: link.linkedAt.toISOString(),
      scopes: link.scopes,
    };
  } catch (err) {
    // Library must load without YouTube env / before migration / with stale db.query wiring
    console.error("[zap youtube] link status lookup failed", { userId }, err);
    return { linked: false as const };
  }
}

export async function revokeYoutubeLink(userId: string) {
  const table = youtubeLinks();
  if (!table) throw error(503, "YouTube link schema is not available — rebuild @pocket-dimension/db");
  await db.update(table).set({ revokedAt: new Date() }).where(eq(table.userId, userId));
}

export async function listYouTubePlaylists(userId: string): Promise<ZapYouTubePlaylist[]> {
  const accessToken = await requireYouTubeAccessTokenForUser(userId);
  const items: ZapYouTubePlaylist[] = [{ id: "LL", title: "Liked videos", thumbnailUrl: null, itemCount: null }];

  let pageToken: string | undefined;
  do {
    const params: Record<string, string> = {
      part: "snippet,contentDetails",
      mine: "true",
      maxResults: "50",
    };
    if (pageToken) params.pageToken = pageToken;

    const body = await youtubeFetch<{
      nextPageToken?: string;
      items?: Array<{
        id: string;
        snippet?: { title?: string; thumbnails?: unknown };
        contentDetails?: { itemCount?: number };
      }>;
    }>("playlists", params, { accessToken, requireUserAuth: true });

    for (const item of body.items ?? []) {
      items.push({
        id: item.id,
        title: youtubeText(item.snippet?.title, "Untitled playlist"),
        thumbnailUrl: bestThumbnail(item.snippet?.thumbnails),
        itemCount: item.contentDetails?.itemCount ?? null,
      });
    }
    pageToken = body.nextPageToken;
  } while (pageToken);

  return items;
}

async function videoDurationMap(videoIds: string[], accessToken: string) {
  const map = new Map<string, number | null>();
  for (let i = 0; i < videoIds.length; i += 50) {
    const chunk = videoIds.slice(i, i + 50);
    if (chunk.length === 0) continue;
    const body = await youtubeFetch<{
      items?: Array<{ id: string; contentDetails?: { duration?: string } }>;
    }>("videos", { part: "contentDetails", id: chunk.join(",") }, { accessToken, requireUserAuth: true });
    for (const item of body.items ?? []) {
      map.set(item.id, durationToMs(item.contentDetails?.duration));
    }
  }
  return map;
}

/** Paginate all items in a playlist (incl. Liked `LL`). */
export async function listYouTubePlaylistItems(userId: string, playlistId: string): Promise<ZapYouTubePlaylistItem[]> {
  const accessToken = await requireYouTubeAccessTokenForUser(userId);
  const results: ZapYouTubePlaylistItem[] = [];
  let pageToken: string | undefined;

  do {
    const params: Record<string, string> = {
      part: "snippet,contentDetails",
      playlistId,
      maxResults: "50",
    };
    if (pageToken) params.pageToken = pageToken;

    const body = await youtubeFetch<{
      nextPageToken?: string;
      items?: Array<{
        snippet?: {
          title?: string;
          description?: string;
          publishedAt?: string;
          position?: number;
          channelTitle?: string;
          videoOwnerChannelTitle?: string;
          videoOwnerChannelId?: string;
          resourceId?: { videoId?: string };
        };
        contentDetails?: { videoId?: string; videoPublishedAt?: string };
      }>;
    }>("playlistItems", params, { accessToken, requireUserAuth: true });

    const pageIds: string[] = [];
    const pageRows: ZapYouTubePlaylistItem[] = [];
    for (const item of body.items ?? []) {
      const videoId = item.contentDetails?.videoId ?? item.snippet?.resourceId?.videoId;
      if (!videoId) continue;
      const ownerTitle = item.snippet?.videoOwnerChannelTitle ?? item.snippet?.channelTitle;
      const position = typeof item.snippet?.position === "number" ? item.snippet.position : null;
      pageIds.push(videoId);
      pageRows.push({
        videoId,
        title: youtubeText(item.snippet?.title, "Untitled"),
        description: item.snippet?.description != null ? youtubeText(item.snippet.description, "") || null : null,
        channelTitle: ownerTitle ? youtubeText(ownerTitle, "") || null : null,
        channelId: item.snippet?.videoOwnerChannelId?.trim() || null,
        position,
        addedAt: item.snippet?.publishedAt ?? null,
        videoPublishedAt: item.contentDetails?.videoPublishedAt ?? null,
        durationMs: null,
        url: `https://www.youtube.com/watch?v=${videoId}`,
      });
    }

    const durations = await videoDurationMap(pageIds, accessToken);
    for (const row of pageRows) {
      row.durationMs = durations.get(row.videoId) ?? null;
      results.push(row);
    }

    pageToken = body.nextPageToken;
  } while (pageToken);

  return results;
}
