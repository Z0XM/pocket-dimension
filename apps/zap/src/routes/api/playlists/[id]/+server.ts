import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import {
  PlaylistError,
  addCollaborator,
  addPlaylistTrack,
  buildPlaylistFromTags,
  deletePlaylist,
  findUserIdByEmailOrUsername,
  getPlaylistDetail,
  removeCollaborator,
  removePlaylistTrack,
  reorderPlaylistTracks,
  setPlaylistExclusion,
  setPlaylistTagQuery,
  sortPlaylistTracksPersisted,
  updatePlaylist,
} from "$lib/server/playlists";

function requireVerifiedUser(locals: App.Locals) {
  if (!locals.user) throw error(401, "Sign in required");
  if (!locals.user.emailVerified) throw error(403, "Verify email first");
  return locals.user;
}

function mapError(err: unknown): never {
  if (err instanceof PlaylistError) throw error(err.status, err.message);
  throw err;
}

export const GET: RequestHandler = async ({ locals, params }) => {
  const user = requireVerifiedUser(locals);
  try {
    const detail = await getPlaylistDetail(params.id!, user.id);
    return json(detail);
  } catch (err) {
    mapError(err);
  }
};

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
  const user = requireVerifiedUser(locals);
  try {
    const body = (await request.json()) as {
      name?: string;
      description?: string | null;
      visibility?: "private" | "public";
    };
    const detail = await updatePlaylist(params.id!, user.id, body);
    return json(detail);
  } catch (err) {
    mapError(err);
  }
};

export const POST: RequestHandler = async ({ locals, params, request }) => {
  const user = requireVerifiedUser(locals);
  try {
    const body = (await request.json()) as {
      action?: string;
      mediaAssetId?: string;
      tagIds?: string[];
      tagQuery?: string | null;
      excluded?: boolean;
      collaborator?: string;
      collaboratorUserId?: string;
      /** Playlist item row ids in the desired order (action=reorder). */
      orderedItemIds?: string[];
      /** Persistable sort key (action=sort). */
      sort?: string;
    };
    const id = params.id!;

    switch (body.action) {
      case "addTrack": {
        if (!body.mediaAssetId) throw error(400, "mediaAssetId required");
        return json(await addPlaylistTrack(id, user.id, body.mediaAssetId));
      }
      case "removeTrack": {
        if (!body.mediaAssetId) throw error(400, "mediaAssetId required");
        return json(await removePlaylistTrack(id, user.id, body.mediaAssetId));
      }
      case "exclude": {
        if (!body.mediaAssetId) throw error(400, "mediaAssetId required");
        return json(await setPlaylistExclusion(id, user.id, body.mediaAssetId, body.excluded !== false));
      }
      case "reorder": {
        if (!Array.isArray(body.orderedItemIds)) throw error(400, "orderedItemIds required");
        return json(await reorderPlaylistTracks(id, user.id, body.orderedItemIds));
      }
      case "sort": {
        if (!body.sort) throw error(400, "sort required");
        return json(await sortPlaylistTracksPersisted(id, user.id, body.sort));
      }
      case "buildFromTags": {
        return json(await buildPlaylistFromTags(id, user.id, body.tagIds ?? []));
      }
      case "setTagQuery": {
        return json(await setPlaylistTagQuery(id, user.id, typeof body.tagQuery === "string" ? body.tagQuery : null));
      }
      case "addCollaborator": {
        let collabId = body.collaboratorUserId?.trim() || "";
        if (!collabId && body.collaborator) {
          collabId = (await findUserIdByEmailOrUsername(body.collaborator)) ?? "";
        }
        if (!collabId) throw error(400, "Collaborator user not found");
        return json(await addCollaborator(id, user.id, collabId));
      }
      case "removeCollaborator": {
        if (!body.collaboratorUserId) throw error(400, "collaboratorUserId required");
        return json(await removeCollaborator(id, user.id, body.collaboratorUserId));
      }
      default:
        throw error(400, "Unknown action");
    }
  } catch (err) {
    mapError(err);
  }
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
  const user = requireVerifiedUser(locals);
  try {
    await deletePlaylist(params.id!, user.id);
    return json({ ok: true });
  } catch (err) {
    mapError(err);
  }
};
