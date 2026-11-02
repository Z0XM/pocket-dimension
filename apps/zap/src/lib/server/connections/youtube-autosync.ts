import { db, schema } from "@pocket-dimension/db";
import { and, eq } from "drizzle-orm";
import { isStorageConfigured } from "$lib/server/storage";
import { resolveYtDlpBin } from "$lib/server/ingest";
import { logConnectionActivity } from "./activity";
import { applyMirrorSync, intervalDue, type YoutubeSyncInterval, type YoutubeSyncMode } from "./youtube-mirror";
import { upsertPlaylistPref } from "./youtube-status";

const inFlight = new Set<string>();

export async function runYouTubeAutoSyncForUser(userId: string): Promise<{
  ran: number;
  skipped: number;
  results: Array<{ playlistId: string; added: number; removed: number; imported: number; error?: string }>;
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
    const results: Array<{ playlistId: string; added: number; removed: number; imported: number; error?: string }> = [];
    let ran = 0;
    let skipped = 0;

    for (const pref of prefs) {
      const interval = (pref.syncInterval as YoutubeSyncInterval | undefined) ?? "off";
      // Legacy rows may have autoSync=true with interval still `off` — treat as hourly.
      const effectiveInterval: YoutubeSyncInterval = interval === "off" && pref.autoSync ? "hourly" : interval;
      if (effectiveInterval === "off" || !pref.zapPlaylistId) {
        skipped += 1;
        continue;
      }
      if (!intervalDue(pref.lastSyncedAt, effectiveInterval, now)) {
        skipped += 1;
        continue;
      }

      try {
        const mode = (pref.syncMode as YoutubeSyncMode | undefined) ?? "additive";
        const result = await applyMirrorSync(userId, pref.youtubePlaylistId, {
          mode,
          asyncImport: false,
        });
        if (result.added === 0 && result.removed === 0 && result.imported === 0) {
          skipped += 1;
          results.push({
            playlistId: pref.youtubePlaylistId,
            added: 0,
            removed: 0,
            imported: 0,
          });
          continue;
        }
        const bits = [
          result.added ? `+${result.added}` : null,
          result.removed ? `−${result.removed}` : null,
          result.imported ? `downloaded ${result.imported}` : null,
        ].filter(Boolean);
        await logConnectionActivity({
          userId,
          provider: "youtube",
          kind: "auto_sync",
          summary: `Auto-synced “${pref.title ?? pref.youtubePlaylistId}” (${mode}): ${bits.join(", ") || "no changes"}`,
          meta: {
            playlistId: pref.youtubePlaylistId,
            zapPlaylistId: result.zapPlaylistId,
            mode,
            added: result.added,
            removed: result.removed,
            imported: result.imported,
          },
        });
        ran += 1;
        results.push({
          playlistId: pref.youtubePlaylistId,
          added: result.added,
          removed: result.removed,
          imported: result.imported,
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
        results.push({ playlistId: pref.youtubePlaylistId, added: 0, removed: 0, imported: 0, error: message });
        ran += 1;
      }
    }

    return { ran, skipped, results };
  } finally {
    inFlight.delete(userId);
  }
}

/** @deprecated Prefer interval-based due checks via {@link intervalDue}. */
export const YOUTUBE_AUTOSYNC_COOLDOWN_MS = 60 * 60 * 1000;
