import { error, json } from "@sveltejs/kit";
import { z } from "zod";
import { env } from "$lib/server/env";
import { readJsonBody } from "$lib/server/http";
import { handleListeningWorkerEvent } from "$lib/server/listening/sessions";
import type { RequestHandler } from "./$types";

const workerEventSchema = z.object({
  sessionId: z.string().min(1),
  event: z.enum(["track_ended", "track_error"]),
  errorMessage: z.string().nullable().optional(),
});

function requireWorkerSecret(request: Request) {
  if (!env.MUSIC_WORKER_SECRET) {
    throw error(503, "Music worker secret is not configured");
  }
  if (request.headers.get("authorization") !== `Bearer ${env.MUSIC_WORKER_SECRET}`) {
    throw error(401, "Invalid worker secret");
  }
}

export const POST: RequestHandler = async ({ request }) => {
  requireWorkerSecret(request);
  const body = await readJsonBody(request, workerEventSchema);
  const snapshot = await handleListeningWorkerEvent(body);

  return json({ ok: true, snapshot });
};
