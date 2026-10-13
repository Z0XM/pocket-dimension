import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { SessionError, createSession, findLiveSessionForUser, joinSessionByCode, listLiveSessionsForUser } from "$lib/server/sessions";
import { canStartSession } from "$lib/server/session-start";

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
    const body = (await request.json().catch(() => ({}))) as { action?: string; code?: string; forceNew?: boolean };
    if (body.action === "join") {
      const snapshot = await joinSessionByCode(user.id, body.code ?? "");
      return json(snapshot);
    }
    const live = await listLiveSessionsForUser(user.id);
    // Prefer resuming an existing live host session unless forceNew.
    if (!body.forceNew) {
      const existing = await findLiveSessionForUser(user.id);
      if (existing && existing.hostUserId === user.id) {
        const { getSessionForUser } = await import("$lib/server/sessions");
        const snapshot = await getSessionForUser(existing.id, user.id);
        return json(snapshot);
      }
    }
    if (!canStartSession(live)) {
      throw new SessionError("Guests can’t start a new session — resume or join instead", 403);
    }
    const snapshot = await createSession(user.id);
    return json(snapshot, { status: 201 });
  } catch (err) {
    mapError(err);
  }
};

/** Live sessions for this user (resume). */
export const GET: RequestHandler = async ({ locals }) => {
  const user = requireVerifiedUser(locals);
  const live = await listLiveSessionsForUser(user.id);
  const primary = live.find((s) => s.role === "host") ?? live[0] ?? null;
  return json({
    sessionId: primary?.id ?? null,
    joinCode: primary?.joinCode ?? null,
    live,
  });
};
