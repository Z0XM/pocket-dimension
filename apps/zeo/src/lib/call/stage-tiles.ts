import type { LocalParticipant, RemoteParticipant, Room } from "livekit-client";
import { findScreenShareParticipant, screenShareTileKey } from "$lib/livekit/screen-share";
import { listRoomParticipants } from "$lib/livekit/room-client";

export type StageTileEntry = {
  key: string;
  kind: "participant" | "screen-share";
  participant: LocalParticipant | RemoteParticipant;
};

export function buildStageTiles(room: Room): StageTileEntry[] {
  const items: StageTileEntry[] = [];
  const screenSharer = findScreenShareParticipant(room);

  if (screenSharer) {
    items.push({
      key: screenShareTileKey(screenSharer.identity),
      kind: "screen-share",
      participant: screenSharer,
    });
  }

  for (const participant of listRoomParticipants(room)) {
    items.push({
      key: participant.identity,
      kind: "participant",
      participant,
    });
  }

  return items;
}

export function pruneTileKeys(keys: string[], validKeys: Set<string>) {
  if (keys.length === 0) return keys;

  const pruned = keys.filter((key) => validKeys.has(key));
  if (pruned.length === keys.length && pruned.every((key, index) => key === keys[index])) {
    return keys;
  }

  return pruned;
}
