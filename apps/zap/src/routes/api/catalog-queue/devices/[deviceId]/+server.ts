import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { clampVolume, isValidDeviceId } from "$lib/catalog-queue";
import { CatalogQueueError, forgetDevice, updateDevice } from "$lib/server/catalog-queue";

function requireVerifiedUser(locals: App.Locals) {
  if (!locals.user) throw error(401, "Sign in required");
  if (!locals.user.emailVerified) throw error(403, "Verify email first");
  return locals.user;
}

function deviceIdParam(raw: string | undefined) {
  if (!isValidDeviceId(raw)) throw error(400, "Invalid device id");
  return raw;
}

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
  const user = requireVerifiedUser(locals);
  const deviceId = deviceIdParam(params.deviceId);
  const body = (await request.json().catch(() => ({}))) as { outputEnabled?: unknown; volume?: unknown; label?: unknown };
  try {
    return json(
      await updateDevice(user.id, deviceId, {
        outputEnabled: typeof body.outputEnabled === "boolean" ? body.outputEnabled : undefined,
        volume: body.volume === undefined ? undefined : (clampVolume(body.volume) ?? undefined),
        label: typeof body.label === "string" ? body.label : undefined,
      })
    );
  } catch (err) {
    if (err instanceof CatalogQueueError) throw error(err.status, err.message);
    throw err;
  }
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
  const user = requireVerifiedUser(locals);
  try {
    return json(await forgetDevice(user.id, deviceIdParam(params.deviceId)));
  } catch (err) {
    if (err instanceof CatalogQueueError) throw error(err.status, err.message);
    throw err;
  }
};
