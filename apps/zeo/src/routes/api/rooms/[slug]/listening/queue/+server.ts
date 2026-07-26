import { error, json } from "@sveltejs/kit";
import { z } from "zod";
import { requireUser } from "$lib/server/authz";
import { readJsonBody } from "$lib/server/http";
import { requireRoomMember } from "$lib/server/listening/authz";
import {
  enqueueListeningItem,
  findActiveListeningSession,
  removeListeningQueueItem,
  reorderListeningQueue,
  requireListeningDj,
} from "$lib/server/listening/sessions";
import { getYouTubeAccessTokenForUser, parseYouTubeVideoId, resolveYouTubeVideo } from "$lib/server/listening/youtube-api";
import { findRoomBySlug } from "$lib/server/rooms";
import type { RequestHandler } from "./$types";

const addQueueItemSchema = z
  .object({
    videoId: z.string().min(1).optional(),
    url: z.string().min(1).optional(),
    title: z.string().min(1).optional(),
    channelTitle: z.string().min(1).nullable().optional(),
    thumbnailUrl: z.string().url().nullable().optional(),
    durationMs: z.number().int().nonnegative().nullable().optional(),
    source: z.enum(["library_yt", "library_ytm", "search", "url"]).optional(),
    placement: z.enum(["next", "last"]).optional(),
  })
  .refine((value) => value.videoId || value.url, "videoId or url is required");

const patchQueueSchema = z.union([
  z.object({ action: z.literal("remove"), itemId: z.string().min(1) }),
  z.object({ action: z.literal("reorder"), orderedIds: z.array(z.string().min(1)) }),
  z.object({ orderedIds: z.array(z.string().min(1)) }),
]);

async function loadRoom(slug: string | undefined) {
  if (!slug) throw error(400, "Room slug is required");
  const room = await findRoomBySlug(slug);
  if (!room) throw error(404, "Room not found");
  return room;
}

function handleQueueError(cause: unknown): never {
  if (cause && typeof cause === "object" && "code" in cause) {
    if (cause.code === "no_active_listening") throw error(404, "No active listening session in this room");
    if (cause.code === "queue_limit_reached") throw error(422, "Shared Listening queue is full");
    if (cause.code === "not_listening_dj") throw error(403, "Only the DJ can manage queue order");
    if (cause.code === "queue_item_not_found") throw error(404, "Queue item not found");
  }
  throw cause;
}

export const POST: RequestHandler = async ({ locals, params, request }) => {
  const user = requireUser(locals);
  const room = await loadRoom(params.slug);
  await requireRoomMember(room, user.id);

  const body = await readJsonBody(request, addQueueItemSchema);
  const videoId = body.videoId ?? (body.url ? parseYouTubeVideoId(body.url) : null);
  if (!videoId) throw error(400, "A valid YouTube videoId or URL is required");

  try {
    const session = await findActiveListeningSession(room.id);
    if (!session) throw Object.assign(new Error("no_active_listening"), { code: "no_active_listening" });

    const needsMetadata = !body.title || !body.thumbnailUrl || body.channelTitle === undefined || body.durationMs === undefined;
    const accessToken = needsMetadata ? await getYouTubeAccessTokenForUser(session.linkerUserId) : null;
    const metadata = needsMetadata ? await resolveYouTubeVideo(videoId, accessToken ?? undefined) : null;

    return json(
      await enqueueListeningItem({
        roomId: room.id,
        addedByUserId: user.id,
        videoId,
        title: body.title ?? metadata?.title,
        channelTitle: body.channelTitle ?? metadata?.channelTitle ?? null,
        thumbnailUrl: body.thumbnailUrl ?? metadata?.thumbnailUrl ?? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        durationMs: body.durationMs ?? metadata?.durationMs ?? null,
        source: body.source ?? (body.url ? "url" : "search"),
        placement: body.placement ?? "last",
      })
    );
  } catch (cause) {
    handleQueueError(cause);
  }
};

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
  const user = requireUser(locals);
  const room = await loadRoom(params.slug);
  await requireRoomMember(room, user.id);

  const session = await findActiveListeningSession(room.id);
  if (!session) throw error(404, "No active listening session in this room");
  try {
    requireListeningDj(session, room, user.id);
    const body = await readJsonBody(request, patchQueueSchema);

    if ("itemId" in body) {
      return json(await removeListeningQueueItem(room.id, body.itemId));
    }

    return json(await reorderListeningQueue(room.id, body.orderedIds));
  } catch (cause) {
    handleQueueError(cause);
  }
};
