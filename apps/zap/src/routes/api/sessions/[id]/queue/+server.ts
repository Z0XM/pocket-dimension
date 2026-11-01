import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { isUuid } from "$lib/admin-access";
import { isEnqueueMode, MAX_BULK_ENQUEUE } from "$lib/catalog-queue";
import { listPlayableCatalogueIds, type CatalogueScope } from "$lib/server/catalogue";
import { userCanViewPlaylist } from "$lib/server/playlist-access";
import { PlaylistError } from "$lib/server/playlists";
import {
  SessionError,
  clearQueue,
  enqueueCatalogueTrack,
  enqueueCatalogueTracks,
  moveQueueItem,
  removeQueueItem,
  reorderQueue,
} from "$lib/server/sessions";
import type { SessionSnapshot } from "$lib/server/sessions/types";

type FilterBody = {
  scope?: string;
  playlistId?: string | null;
  q?: string;
  tagQuery?: string;
  tagIds?: string[];
  untagged?: boolean;
};

function stringIds(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => isUuid(typeof v === "string" ? v : null)).slice(0, max);
}

async function enqueueFiltered(
  sessionId: string,
  userId: string,
  filter: FilterBody,
  mode: string | undefined
): Promise<SessionSnapshot & { notice: string }> {
  const scope: CatalogueScope = filter.scope === "playlist" ? "playlist" : filter.scope === "yours" ? "yours" : "all";
  const playlistId = scope === "playlist" && isUuid(filter.playlistId) ? filter.playlistId : null;
  if (scope === "playlist" && (!playlistId || !(await userCanViewPlaylist(playlistId, userId)))) {
    throw new SessionError("Playlist not found", 404);
  }
  const untagged = Boolean(filter.untagged);
  const tagQuery = untagged ? "" : typeof filter.tagQuery === "string" ? filter.tagQuery : "";
  const { ids, truncated, tagQueryError } = await listPlayableCatalogueIds(
    {
      userId,
      scope,
      playlistId,
      q: typeof filter.q === "string" ? filter.q : "",
      untagged,
      tagQuery,
      tagIds: untagged || tagQuery.trim() ? [] : stringIds(filter.tagIds, 50),
    },
    MAX_BULK_ENQUEUE
  );
  if (tagQueryError) throw new SessionError(tagQueryError, 400);
  if (ids.length === 0) throw new SessionError("No playable tracks match", 400);

  const replace = mode === "replace";
  if (replace) await clearQueue(sessionId, userId);
  const snapshot = await enqueueCatalogueTracks(sessionId, userId, ids, replace ? "play" : isEnqueueMode(mode) ? mode : "last");
  const notice = `${replace ? "Playing" : "Queued"} ${ids.length} track${ids.length === 1 ? "" : "s"}${
    truncated ? ` (first ${MAX_BULK_ENQUEUE})` : ""
  }.`;
  return { ...snapshot, notice };
}

export const POST: RequestHandler = async ({ locals, params, request }) => {
  if (!locals.user) throw error(401, "Sign in required");
  if (!locals.user.emailVerified) throw error(403, "Verify email first");

  try {
    const body = (await request.json()) as {
      mediaAssetId?: string;
      mediaAssetIds?: string[];
      mode?: string;
      action?: string;
      queueItemId?: string;
      direction?: "up" | "down";
      orderedIds?: string[];
      filter?: FilterBody;
    };
    const id = params.id!;
    const uid = locals.user.id;

    if (body.action === "clear") {
      return json(await clearQueue(id, uid));
    }
    if (body.action === "remove") {
      if (!body.queueItemId?.trim()) throw error(400, "queueItemId required");
      return json(await removeQueueItem(id, uid, body.queueItemId.trim()));
    }
    if (body.action === "move") {
      if (!body.queueItemId?.trim()) throw error(400, "queueItemId required");
      if (body.direction !== "up" && body.direction !== "down") throw error(400, "direction must be up|down");
      return json(await moveQueueItem(id, uid, body.queueItemId.trim(), body.direction));
    }
    if (body.action === "reorder") {
      if (!Array.isArray(body.orderedIds)) throw error(400, "orderedIds required");
      return json(await reorderQueue(id, uid, body.orderedIds));
    }
    if (body.action === "enqueueFiltered") {
      return json(await enqueueFiltered(id, uid, body.filter ?? {}, body.mode));
    }

    const mode = body.mode && isEnqueueMode(body.mode) ? body.mode : "last";
    if (Array.isArray(body.mediaAssetIds) && body.mediaAssetIds.length > 0) {
      return json(await enqueueCatalogueTracks(id, uid, body.mediaAssetIds.map(String), mode));
    }
    if (!body.mediaAssetId?.trim()) throw error(400, "mediaAssetId required");
    const snapshot = await enqueueCatalogueTrack(id, uid, body.mediaAssetId.trim(), mode);
    return json(snapshot);
  } catch (err) {
    if (err instanceof SessionError) throw error(err.status, err.message);
    if (err instanceof PlaylistError) throw error(err.status, err.message);
    throw err;
  }
};
