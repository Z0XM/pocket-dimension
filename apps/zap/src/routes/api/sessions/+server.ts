import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { SessionError, createSession, findLiveSessionForUser, joinSessionByCode } from "$lib/server/sessions";

function requireVerifiedUser(locals: App.Locals) {
  if (!locals.user) throw error(401, "Sign in required");
  if (!locals.user.emailVerified) throw error(403, "Verify email first");
  return locals.user;
}

function mapError(err: unknown): never {
  if (err instanceof SessionError) throw error(err.status, err.message);
  throw err;
}

/** Create a new listening session (host). */
export const POST: RequestHandler = async ({ locals, request }) => {
  const user = requireVerifiedUser(locals);
  try {
    const body = (await request.json().catch(() => ({}))) as { action?: string; code?: string };
    if (body.action === "join") {
      const snapshot = await joinSessionByCode(user.id, body.code ?? "");
      return json(snapshot);
    }
    const snapshot = await createSession(user.id);
    return json(snapshot, { status: 201 });
  } catch (err) {
    mapError(err);
  }
};

/** Current live session for this user (if any). */
export const GET: RequestHandler = async ({ locals }) => {
  const user = requireVerifiedUser(locals);
  const session = await findLiveSessionForUser(user.id);
  return json({ sessionId: session?.id ?? null, joinCode: session?.joinCode ?? null });
};
