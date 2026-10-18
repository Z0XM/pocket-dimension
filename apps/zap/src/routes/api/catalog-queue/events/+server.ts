import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { deviceLabelFromUserAgent, isValidDeviceId } from "$lib/catalog-queue";
import { createCatalogQueueStream } from "$lib/server/catalog-queue";

export const GET: RequestHandler = async ({ locals, url, request }) => {
  if (!locals.user) throw error(401, "Sign in required");
  if (!locals.user.emailVerified) throw error(403, "Verify email first");

  const deviceId = url.searchParams.get("deviceId");
  if (!isValidDeviceId(deviceId)) throw error(400, "deviceId required");

  const stream = await createCatalogQueueStream(
    locals.user.id,
    deviceId,
    deviceLabelFromUserAgent(request.headers.get("user-agent")),
    request.signal
  );
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
};
