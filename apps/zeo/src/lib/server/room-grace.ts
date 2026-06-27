import { endRoomById } from "./rooms";

const graceTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function scheduleRoomEmptyGrace(roomId: string, graceSeconds: number) {
  cancelRoomEmptyGrace(roomId);

  const timer = setTimeout(async () => {
    graceTimers.delete(roomId);
    try {
      await endRoomById(roomId, { reason: "empty" });
    } catch {
      // Room may already be ended
    }
  }, graceSeconds * 1000);

  graceTimers.set(roomId, timer);
}

export function cancelRoomEmptyGrace(roomId: string) {
  const timer = graceTimers.get(roomId);
  if (timer) {
    clearTimeout(timer);
    graceTimers.delete(roomId);
  }
}
