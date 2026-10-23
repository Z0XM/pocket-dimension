import { db, schema } from "@pocket-dimension/db";
import { and, eq } from "drizzle-orm";
import { importConnectedPlaylists } from "$lib/server/youtube/import-playlists";
import { isStorageConfigured } from "$lib/server/storage";
import { resolveYtDlpBin } from "$lib/server/ingest";
import { logConnectionActivity } from "./activity";
import { upsertPlaylistPref } from "./youtube-status";

/** Min gap between auto-sync runs for the same playlist (avoid hammering on every navigation). */
export const YOUTUBE_AUTOSYNC_COOLDOWN_MS = 15 * 60 * 1000;

const inFlight = new Set<string>();

export async function runYouTubeAutoSyncForUser(userId: string): Promise<{
  ran: number;
  skipped: number;
  results: Array<{ playlistId: string; imported: number; unavailable: number; skipped: number; error?: string }>;
}> {
  if (inFlight.has(userId)) {
    return { ran: 0, skipped: 0, results: [] };
  }
  inFlight.add(userId);
  try {
    if (!isStorageConfigured() || !(await resolveYtDlpBin())) {
      return { ran: 0, skipped: 0, results: [] };
    }

    const prefs = await db.query.youtubePlaylistPrefs.findMany({
      where: and(eq(schema.youtubePlaylistPrefs.userId, userId), eq(schema.youtubePlaylistPrefs.autoSync, true)),
    });
    if (prefs.length === 0) return { ran: 0, skipped: 0, results: [] };

    const now = Date.now();
    const results: Array<{ playlistId: string; imported: number; unavailable: number; skipped: number; error?: string }> = [];
    let ran = 0;
    let skipped = 0;

    for (const pref of prefs) {
      if (pref.lastSyncedAt && now - pref.lastSyncedAt.getTime() < YOUTUBE_AUTOSYNC_COOLDOWN_MS) {
        skipped += 1;
        continue;
      }

      try {
        // Single crawl inside import (skipExisting) — do not list+preview then list again.
        const result = await importConnectedPlaylists(userId, [pref.youtubePlaylistId], undefined, {
          skipExisting: true,
          sort: "playlist",
        });
        await upsertPlaylistPref({
          userId,
          youtubePlaylistId: pref.youtubePlaylistId,
          title: pref.title,
          lastSyncedAt: new Date(),
          lastSyncError: null,
        });
        if (result.imported === 0 && result.failed === 0) {
          skipped += 1;
          results.push({
            playlistId: pref.youtubePlaylistId,
            imported: 0,
            unavailable: result.unavailable,
            skipped: result.skipped,
          });
          continue;
        }
        await logConnectionActivity({
          userId,
          provider: "youtube",
          kind: "auto_sync",
          summary: `Auto-synced “${pref.title ?? pref.youtubePlaylistId}”: +${result.imported} track${result.imported === 1 ? "" : "s"}`,
          meta: {
            playlistId: pref.youtubePlaylistId,
            imported: result.imported,
            unavailable: result.unavailable,
            skipped: result.skipped,
            failed: result.failed,
          },
        });
        ran += 1;
        results.push({
          playlistId: pref.youtubePlaylistId,
          imported: result.imported,
          unavailable: result.unavailable,
          skipped: result.skipped,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Auto-sync failed";
        await upsertPlaylistPref({
          userId,
          youtubePlaylistId: pref.youtubePlaylistId,
          lastSyncedAt: new Date(),
          lastSyncError: message,
        });
        await logConnectionActivity({
          userId,
          provider: "youtube",
          kind: "auto_sync_error",
          summary: `Auto-sync failed for “${pref.title ?? pref.youtubePlaylistId}”: ${message}`,
          meta: { playlistId: pref.youtubePlaylistId },
        });
        results.push({ playlistId: pref.youtubePlaylistId, imported: 0, unavailable: 0, skipped: 0, error: message });
        ran += 1;
      }
    }

    return { ran, skipped, results };
  } finally {
    inFlight.delete(userId);
  }
}
