import { db, schema } from "@pocket-dimension/db";
import { eq } from "drizzle-orm";
import { error, json } from "@sveltejs/kit";
import { z } from "zod";
import { env } from "$lib/server/env";
import { readJsonBody } from "$lib/server/http";
import { mintListeningBotToken } from "$lib/server/livekit-token";
import { findActiveListeningSession } from "$lib/server/listening/sessions";
import { findRoomBySlug } from "$lib/server/rooms";
import type { RequestHandler } from "./$types";

const botTokenSchema = z
  .object({
    roomId: z.string().min(1).optional(),
    roomSlug: z.string().min(1).optional(),
  })
  .refine((value) => value.roomId || value.roomSlug, "roomId or roomSlug is required");

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
  const body = await readJsonBody(request, botTokenSchema);
  const room = body.roomSlug ? await findRoomBySlug(body.roomSlug) : await db.query.rooms.findFirst({ where: eq(schema.rooms.id, body.roomId!) });

  if (!room) throw error(404, "Room not found");

  const session = await findActiveListeningSession(room.id);
  const identity = session?.botIdentity ?? `listening-bot:${room.id}`;
  const token = await mintListeningBotToken({ livekitRoomName: room.livekitRoomName, identity });

  return json({
    token,
    livekitUrl: env.LIVEKIT_URL,
    livekitRoomName: room.livekitRoomName,
    identity,
  });
};
