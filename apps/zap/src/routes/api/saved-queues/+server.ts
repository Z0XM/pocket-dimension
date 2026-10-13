import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { SessionError } from "$lib/server/sessions";
import { listSavedQueues, saveQueueFromSession } from "$lib/server/saved-queues";

export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.user) throw error(401, "Sign in required");
  if (!locals.user.emailVerified) throw error(403, "Verify email first");
  const queues = await listSavedQueues(locals.user.id);
  return json({ queues });
};

export const POST: RequestHandler = async ({ locals, request }) => {
  if (!locals.user) throw error(401, "Sign in required");
  if (!locals.user.emailVerified) throw error(403, "Verify email first");

  try {
    const body = (await request.json().catch(() => ({}))) as { sessionId?: string; name?: string };
    if (!body.sessionId?.trim()) throw error(400, "sessionId required");
    const saved = await saveQueueFromSession({
      userId: locals.user.id,
      sessionId: body.sessionId.trim(),
      name: body.name,
    });
    return json({ saved });
  } catch (err) {
    if (err instanceof SessionError) throw error(err.status, err.message);
    throw err;
  }
};
