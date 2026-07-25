import { error } from "@sveltejs/kit";
import { listOpenParticipants } from "$lib/server/rooms";

type RoomLike = { id: string; hostUserId: string };

export async function requireRoomMember(room: RoomLike, userId: string) {
  if (room.hostUserId === userId) return;

  const participants = await listOpenParticipants(room.id);
  const isMember = participants.some((participant) => participant.userId === userId);

  if (!isMember) {
    throw error(403, "You must be in this room to access shared listening");
  }
}
