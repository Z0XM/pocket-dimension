import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { isUuid } from "$lib/admin-access";
import { MAX_BULK_ENQUEUE, isEnqueueMode, type CatalogQueueSnapshot } from "$lib/catalog-queue";
import {
  CatalogQueueError,
  buildCatalogQueueSnapshot,
  enqueueTracks,
  removeItem,
  reorderQueue,
  replaceQueue,
  stopQueue,
  transport,
  type TransportAction,
} from "$lib/server/catalog-queue";
import { listPlayableCatalogueIds, type CatalogueScope } from "$lib/server/catalogue";
import { userCanViewPlaylist } from "$lib/server/playlist-access";
import { PlaylistError, listPlaylistAssetIds } from "$lib/server/playlists";

const TRANSPORT_ACTIONS: readonly TransportAction[] = ["play", "pause", "seek", "next", "previous", "jump", "ended"];

type FilterBody = { scope?: string; playlistId?: string | null; q?: string; tagQuery?: string; tagIds?: string[] };

type Body = {
  action?: string;
  mode?: string;
  mediaAssetIds?: unknown;
  filter?: FilterBody;
  playlistId?: string;
  itemId?: string;
  order?: unknown;
  positionMs?: number;
  generation?: number;
};

function requireVerifiedUser(locals: App.Locals) {
  if (!locals.user) throw error(401, "Sign in required");
  if (!locals.user.emailVerified) throw error(403, "Verify email first");
  return locals.user;
}

function stringIds(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => isUuid(typeof v === "string" ? v : null)).slice(0, max);
}

async function addBulk(userId: string, ids: string[], mode: string | undefined, truncated: boolean) {
  if (ids.length === 0) throw new CatalogQueueError("No playable tracks match");
  const snapshot: CatalogQueueSnapshot =
    mode === "replace" ? await replaceQueue(userId, ids, { play: true }) : await enqueueTracks(userId, ids, isEnqueueMode(mode) ? mode : "last");
  const notice = `${mode === "replace" ? "Playing" : "Queued"} ${ids.length} track${ids.length === 1 ? "" : "s"}${
    truncated ? ` (first ${MAX_BULK_ENQUEUE})` : ""
  }.`;
  return { ...snapshot, notice };
}

export const GET: RequestHandler = async ({ locals }) => {
  const user = requireVerifiedUser(locals);
  return json(await buildCatalogQueueSnapshot(user.id));
};

export const POST: RequestHandler = async ({ locals, request }) => {
  const user = requireVerifiedUser(locals);
  const body = (await request.json().catch(() => ({}))) as Body;
  const action = body.action ?? "";

  try {
    if (action === "enqueue") {
      const ids = stringIds(body.mediaAssetIds, MAX_BULK_ENQUEUE);
      if (ids.length === 0) throw error(400, "mediaAssetIds required");
      if (!isEnqueueMode(body.mode)) throw error(400, "mode must be play|next|queue|last");
      return json(await enqueueTracks(user.id, ids, body.mode));
    }

    if (action === "enqueueFiltered") {
      const f = body.filter ?? {};
      const scope: CatalogueScope = f.scope === "playlist" ? "playlist" : f.scope === "yours" ? "yours" : "all";
      const playlistId = scope === "playlist" && isUuid(f.playlistId) ? f.playlistId : null;
      if (scope === "playlist" && (!playlistId || !(await userCanViewPlaylist(playlistId, user.id)))) throw error(404, "Playlist not found");
      const tagQuery = typeof f.tagQuery === "string" ? f.tagQuery : "";
      const { ids, truncated, tagQueryError } = await listPlayableCatalogueIds(
        {
          userId: user.id,
          scope,
          playlistId,
          q: typeof f.q === "string" ? f.q : "",
          tagQuery,
          tagIds: tagQuery.trim() ? [] : stringIds(f.tagIds, 50),
        },
        MAX_BULK_ENQUEUE
      );
      if (tagQueryError) throw error(400, tagQueryError);
      return json(await addBulk(user.id, ids, body.mode, truncated));
    }

    if (action === "enqueuePlaylist") {
      if (!isUuid(body.playlistId)) throw error(400, "playlistId required");
      const all = await listPlaylistAssetIds(body.playlistId, user.id);
      return json(await addBulk(user.id, all.slice(0, MAX_BULK_ENQUEUE), body.mode, all.length > MAX_BULK_ENQUEUE));
    }

    if (action === "remove") {
      if (!isUuid(body.itemId)) throw error(400, "itemId required");
      return json(await removeItem(user.id, body.itemId));
    }

    if (action === "reorder") {
      const order = stringIds(body.order, 2000);
      if (order.length === 0) throw error(400, "order required");
      return json(await reorderQueue(user.id, order));
    }

    if (action === "stop") return json(await stopQueue(user.id));

    if ((TRANSPORT_ACTIONS as readonly string[]).includes(action)) {
      return json(
        await transport(user.id, action as TransportAction, {
          positionMs: typeof body.positionMs === "number" ? body.positionMs : undefined,
          itemId: isUuid(body.itemId) ? body.itemId : undefined,
          generation: typeof body.generation === "number" ? body.generation : undefined,
        })
      );
    }

    throw error(400, "Unknown action");
  } catch (err) {
    if (err instanceof CatalogQueueError || err instanceof PlaylistError) throw error(err.status, err.message);
    throw err;
  }
};
