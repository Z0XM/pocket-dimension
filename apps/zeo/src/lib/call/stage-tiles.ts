import type { LocalParticipant, RemoteParticipant, Room } from "livekit-client";
import { findScreenCaptureParticipant, isScreenShareActive, isScreenShareAudioOnlyActive, screenShareTileKey } from "$lib/livekit/screen-share";
import { listRoomParticipants } from "$lib/livekit/room-client";

export type StageTileEntry = {
  key: string;
  kind: "participant" | "screen-share";
  participant: LocalParticipant | RemoteParticipant;
  audioOnly?: boolean;
};

export function participantHasActiveVideo(participant: LocalParticipant | RemoteParticipant) {
  return participant.isCameraEnabled;
}

export function buildStageTiles(room: Room): StageTileEntry[] {
  const items: StageTileEntry[] = [];
  const screenSharer = findScreenCaptureParticipant(room);

  if (screenSharer) {
    items.push({
      key: screenShareTileKey(screenSharer.identity),
      kind: "screen-share",
      participant: screenSharer,
      audioOnly: isScreenShareAudioOnlyActive(screenSharer) && !isScreenShareActive(screenSharer),
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

export function filterStageTiles(tiles: StageTileEntry[], options?: { hideNonVideo?: boolean }) {
  if (!options?.hideNonVideo) return tiles;

  return tiles.filter((tile) => tile.kind === "screen-share" || participantHasActiveVideo(tile.participant));
}

export function pruneTileKeys(keys: string[], validKeys: Set<string>) {
  if (keys.length === 0) return keys;

  const pruned = keys.filter((key) => validKeys.has(key));
  if (pruned.length === keys.length && pruned.every((key, index) => key === keys[index])) {
    return keys;
  }

  return pruned;
}

export type CallParticipantInfo = {
  identity: string;
  displayName: string;
  isLocal: boolean;
  isHost: boolean;
  isGuest: boolean;
  micEnabled: boolean;
  camEnabled: boolean;
};

export function buildCallParticipantList(room: Room, options: { localDisplayName: string; hostUserId: string }): CallParticipantInfo[] {
  return listRoomParticipants(room).map((participant) => ({
    identity: participant.identity,
    displayName: participant.identity === room.localParticipant.identity ? options.localDisplayName : participant.name || "Participant",
    isLocal: participant.identity === room.localParticipant.identity,
    isHost: participant.identity === options.hostUserId,
    isGuest: participant.identity.startsWith("guest_"),
    micEnabled: participant.isMicrophoneEnabled,
    camEnabled: participant.isCameraEnabled,
  }));
}
