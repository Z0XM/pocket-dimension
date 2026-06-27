import type { schema } from "@pocket-dimension/db";

type RoomRow = typeof schema.rooms.$inferSelect;

export function isRoomScheduledForFuture(room: Pick<RoomRow, "scheduledStartAt">) {
  return Boolean(room.scheduledStartAt && room.scheduledStartAt.getTime() > Date.now());
}

export function isRoomJoinable(room: Pick<RoomRow, "status" | "scheduledStartAt">, options?: { isHost?: boolean }) {
  if (room.status === "ended") return false;
  if (isRoomScheduledForFuture(room) && !options?.isHost) return false;
  return true;
}

export function formatScheduledStart(date: Date) {
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
