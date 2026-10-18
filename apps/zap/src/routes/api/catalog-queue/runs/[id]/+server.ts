import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { isUuid } from "$lib/admin-access";
import { CatalogQueueError, activateRun, deleteRun, saveRunAsPlaylist } from "$lib/server/catalog-queue";
import { PlaylistError } from "$lib/server/playlists";

function requireVerifiedUser(locals: App.Locals) {
  if (!locals.user) throw error(401, "Sign in required");
  if (!locals.user.emailVerified) throw error(403, "Verify email first");
  return locals.user;
}

function mapError(err: unknown): never {
  if (err instanceof CatalogQueueError || err instanceof PlaylistError) throw error(err.status, err.message);
  throw err;
}

/** `restart` / `resume` make this run the active queue; `savePlaylist` copies it into a freehand playlist. */
export const POST: RequestHandler = async ({ locals, params, request }) => {
  const user = requireVerifiedUser(locals);
  if (!isUuid(params.id)) throw error(404, "Queue not found");
  const body = (await request.json().catch(() => ({}))) as { action?: string; name?: string };
  try {
    if (body.action === "restart" || body.action === "resume") return json(await activateRun(user.id, params.id, body.action));
    if (body.action === "savePlaylist") return json(await saveRunAsPlaylist(user.id, params.id, body.name ?? ""), { status: 201 });
    throw error(400, "action must be restart|resume|savePlaylist");
  } catch (err) {
    mapError(err);
  }
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
  const user = requireVerifiedUser(locals);
  if (!isUuid(params.id)) throw error(404, "Queue not found");
  try {
    return json(await deleteRun(user.id, params.id));
  } catch (err) {
    mapError(err);
  }
};
