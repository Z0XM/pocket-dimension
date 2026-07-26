import { db, schema } from "@pocket-dimension/db";
import { and, eq, isNull } from "drizzle-orm";
import { error } from "@sveltejs/kit";
import { env } from "$lib/server/env";
import { decryptToken, encryptToken } from "./tokens";
import { refreshYouTubeAccessToken } from "./youtube-oauth";
import type { ListeningQueueSource } from "./types";

const DATA_API_URL = "https://www.googleapis.com/youtube/v3";
const YOUTUBE_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/;

export type YouTubeVideoResult = {
  videoId: string;
  title: string;
  channelTitle: string | null;
  thumbnailUrl: string | null;
  durationMs: number | null;
  source: ListeningQueueSource;
};

export type YouTubePlaylist = {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  itemCount: number | null;
  source: "library_yt";
};

export async function getYouTubeAccessTokenForUser(userId: string) {
  const link = await db.query.youtubeAccountLinks.findFirst({
    where: and(eq(schema.youtubeAccountLinks.userId, userId), isNull(schema.youtubeAccountLinks.revokedAt)),
  });
  if (!link) return null;

  if (link.accessExpiresAt.getTime() > Date.now() + 60_000) {
    return decryptToken(link.accessTokenEnc);
  }

  const refreshToken = decryptToken(link.refreshTokenEnc);
  const refreshed = await refreshYouTubeAccessToken(refreshToken);
  await db
    .update(schema.youtubeAccountLinks)
    .set({
      accessTokenEnc: encryptToken(refreshed.accessToken),
      accessExpiresAt: refreshed.accessExpiresAt,
      scopes: refreshed.scopes,
      revokedAt: null,
    })
    .where(eq(schema.youtubeAccountLinks.userId, userId));

  return refreshed.accessToken;
}

export async function requireYouTubeAccessTokenForUser(userId: string) {
  const accessToken = await getYouTubeAccessTokenForUser(userId);
  if (!accessToken) {
    throw error(403, "YouTube account is not linked");
  }
  return accessToken;
}

export function parseYouTubeVideoId(input: string) {
  const value = input.trim();
  if (YOUTUBE_ID_PATTERN.test(value)) return value;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (url.hostname === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0];
    return id && YOUTUBE_ID_PATTERN.test(id) ? id : null;
  }

  if (!/(^|\.)youtube\.com$/.test(url.hostname)) {
    return null;
  }

  const watchId = url.searchParams.get("v");
  if (watchId && YOUTUBE_ID_PATTERN.test(watchId)) return watchId;

  const [kind, id] = url.pathname.split("/").filter(Boolean);
  if ((kind === "shorts" || kind === "embed" || kind === "live") && id && YOUTUBE_ID_PATTERN.test(id)) {
    return id;
  }

  return null;
}

function durationToMs(duration: string | undefined) {
  if (!duration) return null;
  const match = duration.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return null;

  const [, days = "0", hours = "0", minutes = "0", seconds = "0"] = match;
  return Number(days) * 24 * 60 * 60 * 1000 + Number(hours) * 60 * 60 * 1000 + Number(minutes) * 60 * 1000 + Number(seconds) * 1000;
}

/** YouTube Data API snippet titles often include HTML entities (e.g. `&quot;`). */
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

function youtubeTextOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? decodeHtmlEntities(trimmed) : null;
}

function bestThumbnail(thumbnails: unknown) {
  if (!thumbnails || typeof thumbnails !== "object") return null;
  const values = Object.values(thumbnails as Record<string, { url?: string; width?: number }>);
  return values.sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0]?.url ?? null;
}

type YoutubeFetchAuth = {
  /** OAuth user token — required for mine=true / library calls. */
  accessToken?: string;
  /**
   * When true, always send the OAuth bearer token.
   * When false/omitted, prefer YOUTUBE_DATA_API_KEY for public search/videos
   * (avoids "insufficient authentication scopes" from a narrow user token).
   */
  requireUserAuth?: boolean;
};

async function youtubeFetch<T>(path: string, params: Record<string, string>, auth: YoutubeFetchAuth = {}): Promise<T> {
  const url = new URL(`${DATA_API_URL}/${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const headers: HeadersInit = {};
  const useUserAuth = Boolean(auth.requireUserAuth && auth.accessToken);
  if (useUserAuth) {
    headers.Authorization = `Bearer ${auth.accessToken}`;
  } else if (env.YOUTUBE_DATA_API_KEY) {
    url.searchParams.set("key", env.YOUTUBE_DATA_API_KEY);
  } else if (auth.accessToken) {
    headers.Authorization = `Bearer ${auth.accessToken}`;
  } else {
    throw error(503, "YouTube Data API credentials are not configured (set YOUTUBE_DATA_API_KEY)");
  }

  const response = await fetch(url, { headers });
  const body = (await response.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!response.ok) {
    throw error(response.status, body.error?.message ?? "YouTube Data API request failed");
  }
  return body;
}

export async function listYouTubePlaylists(userId: string): Promise<YouTubePlaylist[]> {
  const accessToken = await requireYouTubeAccessTokenForUser(userId);
  const body = await youtubeFetch<{
    items?: Array<{
      id: string;
      snippet?: { title?: string; thumbnails?: unknown };
      contentDetails?: { itemCount?: number };
    }>;
  }>("playlists", { part: "snippet,contentDetails", mine: "true", maxResults: "50" }, { accessToken, requireUserAuth: true });

  return [
    { id: "LL", title: "Liked videos", thumbnailUrl: null, itemCount: null, source: "library_yt" },
    ...(body.items ?? []).map((item) => ({
      id: item.id,
      title: youtubeText(item.snippet?.title, "Untitled playlist"),
      thumbnailUrl: bestThumbnail(item.snippet?.thumbnails),
      itemCount: item.contentDetails?.itemCount ?? null,
      source: "library_yt" as const,
    })),
  ];
}

export async function listYouTubePlaylistItems(userId: string, playlistId: string): Promise<YouTubeVideoResult[]> {
  const accessToken = await requireYouTubeAccessTokenForUser(userId);
  const body = await youtubeFetch<{
    items?: Array<{
      snippet?: {
        title?: string;
        channelTitle?: string;
        thumbnails?: unknown;
        resourceId?: { videoId?: string };
      };
      contentDetails?: { videoId?: string };
    }>;
  }>("playlistItems", { part: "snippet,contentDetails", playlistId, maxResults: "50" }, { accessToken, requireUserAuth: true });

  const ids = (body.items ?? [])
    .map((item) => item.contentDetails?.videoId ?? item.snippet?.resourceId?.videoId)
    .filter((id): id is string => Boolean(id));
  const metadata = await videoMetadataMap(ids);

  const results: YouTubeVideoResult[] = [];
  for (const item of body.items ?? []) {
    const videoId = item.contentDetails?.videoId ?? item.snippet?.resourceId?.videoId;
    if (!videoId) continue;
    const details = metadata.get(videoId);
    results.push({
      videoId,
      title: youtubeText(item.snippet?.title ?? details?.title, "Untitled video"),
      channelTitle: youtubeTextOrNull(item.snippet?.channelTitle ?? details?.channelTitle),
      thumbnailUrl: bestThumbnail(item.snippet?.thumbnails) ?? details?.thumbnailUrl ?? null,
      durationMs: details?.durationMs ?? null,
      source: "library_yt",
    });
  }

  return results;
}

export async function searchYouTubeVideos(query: string, accessToken?: string): Promise<YouTubeVideoResult[]> {
  const body = await youtubeFetch<{
    items?: Array<{
      id?: { videoId?: string };
      snippet?: { title?: string; channelTitle?: string; thumbnails?: unknown };
    }>;
  }>("search", { part: "snippet", q: query, type: "video", maxResults: "10", safeSearch: "none" }, { accessToken });

  const ids = (body.items ?? []).map((item) => item.id?.videoId).filter((id): id is string => Boolean(id));
  // Public metadata — prefer API key over user OAuth token.
  const metadata = await videoMetadataMap(ids, accessToken);

  const results: YouTubeVideoResult[] = [];
  for (const item of body.items ?? []) {
    const videoId = item.id?.videoId;
    if (!videoId) continue;
    const details = metadata.get(videoId);
    results.push({
      videoId,
      title: youtubeText(item.snippet?.title ?? details?.title, "Untitled video"),
      channelTitle: youtubeTextOrNull(item.snippet?.channelTitle ?? details?.channelTitle),
      thumbnailUrl: bestThumbnail(item.snippet?.thumbnails) ?? details?.thumbnailUrl ?? null,
      durationMs: details?.durationMs ?? null,
      source: "search",
    });
  }

  return results;
}

async function resolveYouTubeVideoViaOEmbed(videoId: string): Promise<YouTubeVideoResult | null> {
  try {
    const url = new URL("https://www.youtube.com/oembed");
    url.searchParams.set("url", `https://www.youtube.com/watch?v=${videoId}`);
    url.searchParams.set("format", "json");
    const response = await fetch(url);
    if (!response.ok) return null;
    const body = (await response.json()) as { title?: string; author_name?: string; thumbnail_url?: string };
    return {
      videoId,
      title: youtubeText(body.title, videoId),
      channelTitle: youtubeTextOrNull(body.author_name),
      thumbnailUrl: body.thumbnail_url?.trim() || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      durationMs: null,
      source: "url",
    };
  } catch {
    return null;
  }
}

export async function resolveYouTubeVideo(videoId: string, accessToken?: string): Promise<YouTubeVideoResult | null> {
  const fromApi = await videoMetadataMap([videoId], accessToken).catch(() => null);
  const hit = fromApi?.get(videoId);
  if (hit) {
    return {
      ...hit,
      thumbnailUrl: hit.thumbnailUrl ?? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    };
  }

  const fromOEmbed = await resolveYouTubeVideoViaOEmbed(videoId);
  if (fromOEmbed) return fromOEmbed;

  // Last resort so URL-enqueued items still show art (title falls back to videoId in sessions).
  return {
    videoId,
    title: videoId,
    channelTitle: null,
    thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    durationMs: null,
    source: "url",
  };
}

async function videoMetadataMap(videoIds: string[], accessToken?: string) {
  if (videoIds.length === 0) return new Map<string, YouTubeVideoResult>();

  const body = await youtubeFetch<{
    items?: Array<{
      id: string;
      snippet?: { title?: string; channelTitle?: string; thumbnails?: unknown };
      contentDetails?: { duration?: string };
    }>;
  }>("videos", { part: "snippet,contentDetails", id: [...new Set(videoIds)].join(",") }, { accessToken });

  return new Map(
    (body.items ?? []).map((item) => [
      item.id,
      {
        videoId: item.id,
        title: youtubeText(item.snippet?.title, "Untitled video"),
        channelTitle: youtubeTextOrNull(item.snippet?.channelTitle),
        thumbnailUrl: bestThumbnail(item.snippet?.thumbnails),
        durationMs: durationToMs(item.contentDetails?.duration),
        source: "search" as const,
      },
    ])
  );
}
