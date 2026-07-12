import { Track, type RemoteParticipant, type Room } from "livekit-client";
import { screenShareTileKey } from "./screen-share";

export type TileListenKind = "participant" | "screen-share";

export function listenSourceForTileKind(kind: TileListenKind) {
  return kind === "screen-share" ? Track.Source.ScreenShareAudio : Track.Source.Microphone;
}

export function isTileListenMuted(mutedTileKeys: ReadonlySet<string>, tileKey: string) {
  return mutedTileKeys.has(tileKey);
}

export function applyRemoteTileListenVolume(participant: RemoteParticipant, kind: TileListenKind, tileMuted: boolean, speakersEnabled: boolean) {
  const volume = speakersEnabled && !tileMuted ? 1 : 0;
  participant.setVolume(volume, listenSourceForTileKind(kind));
}

export function applyAllTileListenVolumes(
  room: Room,
  options: {
    speakersEnabled: boolean;
    mutedTileKeys: ReadonlySet<string>;
  }
) {
  const { speakersEnabled, mutedTileKeys } = options;

  for (const participant of room.remoteParticipants.values()) {
    applyRemoteTileListenVolume(participant, "participant", isTileListenMuted(mutedTileKeys, participant.identity), speakersEnabled);
    applyRemoteTileListenVolume(
      participant,
      "screen-share",
      isTileListenMuted(mutedTileKeys, screenShareTileKey(participant.identity)),
      speakersEnabled
    );
  }
}
