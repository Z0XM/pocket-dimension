import { error, json } from "@sveltejs/kit";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@pocket-dimension/db";
import { env } from "$lib/server/env";
import { readJsonBody } from "$lib/server/http";
import { markListeningMediaReady } from "$lib/server/listening/media-ready";
import { publishListeningSnapshot } from "$lib/server/listening/sessions";
import type { RequestHandler } from "./$types";

const mediaReadySchema = z.object({
  videoId: z.string().min(1),
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
  const body = await readJsonBody(request, mediaReadySchema);
  const newlyReady = markListeningMediaReady(body.videoId);
  if (!newlyReady) {
    return json({ ok: true, changed: false });
  }

  const sessions = await db.query.listeningSessions.findMany({
    where: isNull(schema.listeningSessions.endedAt),
  });

  await Promise.all(
    sessions.map(async (session) => {
      const hit = await db.query.listeningQueueItems.findFirst({
        where: and(eq(schema.listeningQueueItems.sessionId, session.id), eq(schema.listeningQueueItems.videoId, body.videoId)),
      });
      if (hit) {
        await publishListeningSnapshot(session.id);
      }
    })
  );

  return json({ ok: true, changed: true });
};
