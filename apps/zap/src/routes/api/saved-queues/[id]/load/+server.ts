import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { SessionError } from "$lib/server/sessions";
import { loadSavedQueueIntoSession } from "$lib/server/saved-queues";

export const POST: RequestHandler = async ({ locals, params, request }) => {
  if (!locals.user) throw error(401, "Sign in required");
  if (!locals.user.emailVerified) throw error(403, "Verify email first");

  try {
    const body = (await request.json().catch(() => ({}))) as { sessionId?: string };
    if (!body.sessionId?.trim()) throw error(400, "sessionId required");
    const snapshot = await loadSavedQueueIntoSession(body.sessionId.trim(), locals.user.id, params.id!);
    return json(snapshot);
  } catch (err) {
    if (err instanceof SessionError) throw error(err.status, err.message);
    throw err;
  }
};
