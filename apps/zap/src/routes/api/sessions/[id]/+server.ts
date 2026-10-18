import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import {
  SessionError,
  endSession,
  getSessionForUser,
  setGuestPermissions,
  setMemberOutput,
  setMemberPermissions,
  setSessionOptions,
} from "$lib/server/sessions";

function requireVerifiedUser(locals: App.Locals) {
  if (!locals.user) throw error(401, "Sign in required");
  if (!locals.user.emailVerified) throw error(403, "Verify email first");
  return locals.user;
}

function mapError(err: unknown): never {
  if (err instanceof SessionError) throw error(err.status, err.message);
  throw err;
}

export const GET: RequestHandler = async ({ locals, params }) => {
  const user = requireVerifiedUser(locals);
  try {
    const snapshot = await getSessionForUser(params.id!, user.id);
    return json(snapshot);
  } catch (err) {
    mapError(err);
  }
};

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
  const user = requireVerifiedUser(locals);
  try {
    const body = (await request.json()) as {
      guestsCanAdd?: boolean;
      guestsCanControl?: boolean;
      autoPlay?: boolean;
      perpetual?: boolean;
      memberUserId?: string;
      permissions?: {
        canAdd?: boolean;
        canPlayPause?: boolean;
        canSkip?: boolean;
        canSeek?: boolean;
        canReorder?: boolean;
        canSetup?: boolean;
      };
      outputEnabled?: boolean;
      volume?: number;
    };

    if (body.memberUserId && body.permissions) {
      const snapshot = await setMemberPermissions(params.id!, user.id, body.memberUserId, body.permissions);
      return json(snapshot);
    }
    if (body.memberUserId && (body.outputEnabled !== undefined || body.volume !== undefined)) {
      const snapshot = await setMemberOutput(params.id!, user.id, body.memberUserId, {
        outputEnabled: body.outputEnabled,
        volume: body.volume,
      });
      return json(snapshot);
    }
    if (body.autoPlay !== undefined || body.perpetual !== undefined) {
      if (body.guestsCanAdd === undefined && body.guestsCanControl === undefined) {
        const snapshot = await setSessionOptions(params.id!, user.id, {
          autoPlay: body.autoPlay,
          perpetual: body.perpetual,
        });
        return json(snapshot);
      }
    }
    const snapshot = await setGuestPermissions(params.id!, user.id, body);
    return json(snapshot);
  } catch (err) {
    mapError(err);
  }
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
  const user = requireVerifiedUser(locals);
  try {
    const snapshot = await endSession(params.id!, user.id);
    return json(snapshot ?? { ok: true });
  } catch (err) {
    mapError(err);
  }
};
