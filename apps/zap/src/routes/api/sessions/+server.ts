import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import {
  SessionError,
  createSession,
  findLiveSessionForUser,
  joinSessionByCode,
  listLiveSessionsForUser,
  listSessionsIndexForUser,
} from "$lib/server/sessions";
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
    const body = (await request.json().catch(() => ({}))) as {
      action?: string;
      code?: string;
      forceNew?: boolean;
      perpetual?: boolean;
      name?: string | null;
    };
    if (body.action === "join") {
      const snapshot = await joinSessionByCode(user.id, body.code ?? "");
      return json(snapshot);
    }
    const live = await listLiveSessionsForUser(user.id);
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
    const snapshot = await createSession(user.id, { perpetual: Boolean(body.perpetual), name: body.name });
    return json(snapshot, { status: 201 });
  } catch (err) {
    mapError(err);
  }
};

/** Live + perpetual sessions for this user (resume / rejoin). */
export const GET: RequestHandler = async ({ locals, url }) => {
  const user = requireVerifiedUser(locals);
  const index = url.searchParams.get("index") === "1";
  const live = index ? await listSessionsIndexForUser(user.id) : await listLiveSessionsForUser(user.id);
  const primary = live.find((s) => s.role === "host" && s.status === "live") ?? live.find((s) => s.status === "live") ?? live[0] ?? null;
  return json({
    sessionId: primary?.id ?? null,
    joinCode: primary?.joinCode ?? null,
    live,
  });
};
