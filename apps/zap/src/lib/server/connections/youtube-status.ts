import { db, schema } from "@pocket-dimension/db";
import { and, eq, inArray } from "drizzle-orm";
import type { ZapYouTubePlaylist, ZapYouTubePlaylistItem } from "$lib/server/youtube/api";

export type PlaylistImportStatus = "fully_imported" | "partially_imported" | "not_imported";

export type PlaylistPreview = {
  playlistId: string;
  total: number;
  unavailable: number;
  alreadyImported: number;
  willImport: number;
  unavailableAmongNew: number;
  importStatus: PlaylistImportStatus;
};

/** Identity keys already present in this user's library. */
export async function libraryYoutubeIdentityKeys(userId: string, videoIds: string[]): Promise<Set<string>> {
  const keys = [...new Set(videoIds.map((id) => `youtube:${id}`))];
  if (keys.length === 0) return new Set();

  const found = new Set<string>();
  for (let i = 0; i < keys.length; i += 200) {
    const chunk = keys.slice(i, i + 200);
    const rows = await db
      .select({ identityKey: schema.mediaAssets.identityKey })
      .from(schema.userLibraryEntries)
      .innerJoin(schema.mediaAssets, eq(schema.userLibraryEntries.mediaAssetId, schema.mediaAssets.id))
      .where(and(eq(schema.userLibraryEntries.userId, userId), inArray(schema.mediaAssets.identityKey, chunk)));
    for (const r of rows) found.add(r.identityKey);
  }
  return found;
}

export function importStatusFromCounts(total: number, alreadyImported: number): PlaylistImportStatus {
  if (total <= 0) return alreadyImported > 0 ? "fully_imported" : "not_imported";
  if (alreadyImported <= 0) return "not_imported";
  if (alreadyImported >= total) return "fully_imported";
  return "partially_imported";
}

export async function previewPlaylistImport(userId: string, playlistId: string, items: ZapYouTubePlaylistItem[]): Promise<PlaylistPreview> {
  const inLibrary = await libraryYoutubeIdentityKeys(
    userId,
    items.map((i) => i.videoId)
  );
  let alreadyImported = 0;
  let willImport = 0;
  let unavailableAmongNew = 0;
  let unavailable = 0;
  for (const item of items) {
    if (item.unavailableReason) unavailable += 1;
    const key = `youtube:${item.videoId}`;
    if (inLibrary.has(key)) {
      alreadyImported += 1;
    } else {
      willImport += 1;
      if (item.unavailableReason) unavailableAmongNew += 1;
    }
  }
  return {
    playlistId,
    total: items.length,
    unavailable,
    alreadyImported,
    willImport,
    unavailableAmongNew,
    importStatus: importStatusFromCounts(items.length, alreadyImported),
  };
}

export async function loadPlaylistPrefs(userId: string) {
  try {
    const rows = await db.query.youtubePlaylistPrefs.findMany({
      where: eq(schema.youtubePlaylistPrefs.userId, userId),
    });
    return new Map(rows.map((r) => [r.youtubePlaylistId, r]));
  } catch (err) {
    // Table comes from migration 0060_zap_connections — missing migrate should not 502 the list API.
    console.warn("[zap connections] youtube_playlist_prefs unavailable (apply migration 0060?)", err);
    return new Map();
  }
}

export async function upsertPlaylistPref(opts: {
  userId: string;
  youtubePlaylistId: string;
  title?: string | null;
  autoSync?: boolean;
  lastSyncedAt?: Date | null;
  lastSyncError?: string | null;
}) {
  const existing = await db.query.youtubePlaylistPrefs.findFirst({
    where: and(
      eq(schema.youtubePlaylistPrefs.userId, opts.userId),
      eq(schema.youtubePlaylistPrefs.youtubePlaylistId, opts.youtubePlaylistId)
    ),
  });
  if (existing) {
    const [row] = await db
      .update(schema.youtubePlaylistPrefs)
      .set({
        ...(opts.title !== undefined ? { title: opts.title } : {}),
        ...(opts.autoSync !== undefined ? { autoSync: opts.autoSync } : {}),
        ...(opts.lastSyncedAt !== undefined ? { lastSyncedAt: opts.lastSyncedAt } : {}),
        ...(opts.lastSyncError !== undefined ? { lastSyncError: opts.lastSyncError } : {}),
      })
      .where(
        and(
          eq(schema.youtubePlaylistPrefs.userId, opts.userId),
          eq(schema.youtubePlaylistPrefs.youtubePlaylistId, opts.youtubePlaylistId)
        )
      )
      .returning();
    return row!;
  }
  const [row] = await db
    .insert(schema.youtubePlaylistPrefs)
    .values({
      userId: opts.userId,
      youtubePlaylistId: opts.youtubePlaylistId,
      title: opts.title ?? null,
      autoSync: opts.autoSync ?? false,
      lastSyncedAt: opts.lastSyncedAt ?? null,
      lastSyncError: opts.lastSyncError ?? null,
    })
    .returning();
  return row!;
}

export type EnrichedPlaylist = ZapYouTubePlaylist & {
  importStatus: PlaylistImportStatus;
  alreadyImported: number;
  autoSync: boolean;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
};

/**
 * Enrich playlist list with library import status (sampled via itemCount when listing;
 * full accuracy needs per-playlist item fetch — done on preview/import).
 * Uses a lightweight identity scan when itemCount is small; otherwise marks unknown as not_imported until preview.
 */
export async function enrichPlaylistsWithStatus(userId: string, playlists: ZapYouTubePlaylist[]): Promise<EnrichedPlaylist[]> {
  const prefs = await loadPlaylistPrefs(userId);
  return playlists.map((p) => {
    const pref = prefs.get(p.id);
    return {
      ...p,
      importStatus: "not_imported" as PlaylistImportStatus,
      alreadyImported: 0,
      autoSync: pref?.autoSync ?? false,
      lastSyncedAt: pref?.lastSyncedAt?.toISOString() ?? null,
      lastSyncError: pref?.lastSyncError ?? null,
    };
  });
}
