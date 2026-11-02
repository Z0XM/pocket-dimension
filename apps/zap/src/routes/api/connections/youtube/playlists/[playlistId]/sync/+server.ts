import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getYoutubeLinkStatus } from "$lib/server/youtube";
import { applyMirrorSync, buildMirrorPreview, parseSyncMode } from "$lib/server/connections";
import { logConnectionActivity } from "$lib/server/connections/activity";

export const GET: RequestHandler = async ({ locals, params, url }) => {
  if (!locals.user) throw error(401, "Sign in required");
  if (!locals.user.emailVerified) throw error(403, "Verify email first");

  const status = await getYoutubeLinkStatus(locals.user.id);
  if (!status.linked) throw error(403, "Connect YouTube first");

  const playlistId = params.playlistId?.trim();
  if (!playlistId) throw error(400, "playlistId required");

  const title = url.searchParams.get("title")?.trim() || undefined;
  try {
    const preview = await buildMirrorPreview(locals.user.id, playlistId, { title });
    return json({ preview });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync preview failed";
    throw error(400, message);
  }
};

export const POST: RequestHandler = async ({ locals, params, request }) => {
  if (!locals.user) throw error(401, "Sign in required");
  if (!locals.user.emailVerified) throw error(403, "Verify email first");

  const status = await getYoutubeLinkStatus(locals.user.id);
  if (!status.linked) throw error(403, "Connect YouTube first");

  const playlistId = params.playlistId?.trim();
  if (!playlistId) throw error(400, "playlistId required");

  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    syncMode?: string;
  };

  if (body.action === "discard") {
    return json({ discarded: true });
  }
  if (body.action && body.action !== "accept") {
    throw error(400, "action must be accept or discard");
  }

  const syncMode = body.syncMode !== undefined ? parseSyncMode(body.syncMode) : undefined;
  if (body.syncMode !== undefined && !syncMode) throw error(400, "syncMode must be additive or exact");

  try {
    const result = await applyMirrorSync(locals.user.id, playlistId, {
      ...(syncMode ? { mode: syncMode } : {}),
      asyncImport: true,
    });

    const bits = [
      result.added ? `+${result.added}` : null,
      result.removed ? `−${result.removed}` : null,
      result.jobId ? "download started" : result.imported ? `downloaded ${result.imported}` : null,
    ].filter(Boolean);

    await logConnectionActivity({
      userId: locals.user.id,
      provider: "youtube",
      kind: "playlist_sync",
      summary: `Synced “${result.title}” (${result.syncMode}): ${bits.join(", ") || "no changes"}`,
      meta: {
        playlistId,
        zapPlaylistId: result.zapPlaylistId,
        added: result.added,
        removed: result.removed,
        imported: result.imported,
        jobId: result.jobId,
        syncMode: result.syncMode,
      },
    });

    return json(result, { status: result.jobId ? 202 : 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    throw error(400, message);
  }
};
