/** In-memory live participant counts per room (updated by LiveKit webhooks). */
const liveCounts = new Map<string, number>();

export function getLiveParticipantCount(roomId: string) {
  return liveCounts.get(roomId) ?? 0;
}

export function setLiveParticipantCount(roomId: string, count: number) {
  if (count <= 0) {
    liveCounts.delete(roomId);
    return;
  }
  liveCounts.set(roomId, count);
}

export function incrementLiveParticipantCount(roomId: string) {
  setLiveParticipantCount(roomId, getLiveParticipantCount(roomId) + 1);
}

export function decrementLiveParticipantCount(roomId: string) {
  setLiveParticipantCount(roomId, getLiveParticipantCount(roomId) - 1);
}

export function clearLiveParticipantCount(roomId: string) {
  liveCounts.delete(roomId);
}
