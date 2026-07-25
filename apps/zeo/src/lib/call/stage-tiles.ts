import type { LocalParticipant, RemoteParticipant, Room } from "livekit-client";
import { findScreenCaptureParticipant, isScreenShareActive, isScreenShareAudioOnlyActive, screenShareTileKey } from "$lib/livekit/screen-share";
import { listRoomParticipants } from "$lib/livekit/room-client";

export const LISTENING_BOT_PREFIX = "listening-bot:";

export type StageTileEntry = {
  key: string;
  kind: "participant" | "screen-share" | "listening";
  participant: LocalParticipant | RemoteParticipant;
  audioOnly?: boolean;
};

export function isListeningBotIdentity(identity: string) {
  return identity.startsWith(LISTENING_BOT_PREFIX);
}

export function listeningTileKey(botIdentity: string) {
  return `listening:${botIdentity}`;
}

export function participantHasActiveVideo(participant: LocalParticipant | RemoteParticipant) {
  return participant.isCameraEnabled;
}

export function findListeningBotParticipant(room: Room, botIdentity?: string | null) {
  if (botIdentity) {
    if (room.localParticipant.identity === botIdentity) return room.localParticipant;
    return room.remoteParticipants.get(botIdentity) ?? null;
  }

  for (const participant of listRoomParticipants(room)) {
    if (isListeningBotIdentity(participant.identity)) {
      return participant;
    }
  }
  return null;
}

export function buildStageTiles(room: Room, options?: { listeningBotIdentity?: string | null; listeningActive?: boolean }): StageTileEntry[] {
  const items: StageTileEntry[] = [];
  const screenSharer = findScreenCaptureParticipant(room);

  if (screenSharer && !isListeningBotIdentity(screenSharer.identity)) {
    items.push({
      key: screenShareTileKey(screenSharer.identity),
      kind: "screen-share",
      participant: screenSharer,
      audioOnly: isScreenShareAudioOnlyActive(screenSharer) && !isScreenShareActive(screenSharer),
    });
  }

  if (options?.listeningActive) {
    const bot = findListeningBotParticipant(room, options.listeningBotIdentity) ?? room.localParticipant;
    const identity = options.listeningBotIdentity || bot.identity;
    items.push({
      key: listeningTileKey(identity),
      kind: "listening",
      participant: bot,
      audioOnly: true,
    });
  }

  for (const participant of listRoomParticipants(room)) {
    if (isListeningBotIdentity(participant.identity)) continue;
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

  return tiles.filter((tile) => tile.kind === "screen-share" || tile.kind === "listening" || participantHasActiveVideo(tile.participant));
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
  return listRoomParticipants(room)
    .filter((participant) => !isListeningBotIdentity(participant.identity))
    .map((participant) => ({
      identity: participant.identity,
      displayName: participant.identity === room.localParticipant.identity ? options.localDisplayName : participant.name || "Participant",
      isLocal: participant.identity === room.localParticipant.identity,
      isHost: participant.identity === options.hostUserId,
      isGuest: participant.identity.startsWith("guest_"),
      micEnabled: participant.isMicrophoneEnabled,
      camEnabled: participant.isCameraEnabled,
    }));
}
