import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { isUuid } from "$lib/admin-access";
import {
  PlaylistError,
  createLinkedPlaylist,
  createPlaylist,
  followPlaylistByShareCode,
  listPlaylistsForUser,
  lookupPlaylistByShareCode,
  mergePlaylists,
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

export const GET: RequestHandler = async ({ locals }) => {
  const user = requireVerifiedUser(locals);
  const playlists = await listPlaylistsForUser(user.id);
  return json({ playlists });
};

export const POST: RequestHandler = async ({ locals, request }) => {
  const user = requireVerifiedUser(locals);
  try {
    const body = (await request.json()) as {
      action?: string;
      name?: string;
      description?: string;
      visibility?: "private" | "public";
      tagQuery?: string | null;
      sourcePlaylistIds?: string[];
      mediaAssetIds?: unknown;
      shareCode?: string;
      memberQueries?: string[];
    };

    if (body.action === "merge") {
      const detail = await mergePlaylists({
        userId: user.id,
        sourcePlaylistIds: body.sourcePlaylistIds ?? [],
        name: body.name ?? "Merged playlist",
        visibility: body.visibility,
      });
      return json(detail, { status: 201 });
    }

    if (body.action === "follow") {
      const detail = await followPlaylistByShareCode(user.id, body.shareCode ?? "");
      return json(detail, { status: 201 });
    }

    if (body.action === "lookupShareCode") {
      const summary = await lookupPlaylistByShareCode(user.id, body.shareCode ?? "");
      return json(summary);
    }

    if (body.action === "createLinked") {
      const detail = await createLinkedPlaylist({
        userId: user.id,
        name: body.name ?? "",
        sourcePlaylistIds: (body.sourcePlaylistIds ?? []).filter((id): id is string => isUuid(id)),
        memberQueries: Array.isArray(body.memberQueries) ? body.memberQueries.filter((q): q is string => typeof q === "string") : [],
      });
      return json(detail, { status: 201 });
    }

    const summary = await createPlaylist({
      userId: user.id,
      name: body.name ?? "",
      description: body.description,
      visibility: body.visibility,
      tagQuery: typeof body.tagQuery === "string" ? body.tagQuery : null,
      mediaAssetIds: Array.isArray(body.mediaAssetIds) ? body.mediaAssetIds.filter((id): id is string => isUuid(id)) : undefined,
    });
    return json(summary, { status: 201 });
  } catch (err) {
    mapError(err);
  }
};
