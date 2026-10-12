import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { SessionError, createSessionSSEStream, getSessionForUser } from "$lib/server/sessions";

export const GET: RequestHandler = async ({ locals, params }) => {
  if (!locals.user) throw error(401, "Sign in required");
  if (!locals.user.emailVerified) throw error(403, "Verify email first");

  try {
    const snapshot = await getSessionForUser(params.id!, locals.user.id);
    const stream = createSessionSSEStream(params.id!, snapshot);
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    if (err instanceof SessionError) throw error(err.status, err.message);
    throw err;
  }
};
