import { Track, type RemoteParticipant, type Room } from "livekit-client";
import { screenShareTileKey } from "./screen-share";

export type TileListenKind = "participant" | "screen-share" | "listening";

export const DEFAULT_TILE_VOLUME = 100;

export function listenSourceForTileKind(kind: TileListenKind) {
  return kind === "screen-share" ? Track.Source.ScreenShareAudio : Track.Source.Microphone;
}

export function clampTileVolume(volume: number) {
  if (!Number.isFinite(volume)) return DEFAULT_TILE_VOLUME;
  return Math.min(100, Math.max(0, Math.round(volume)));
}

export function tileVolumeForKey(volumes: Readonly<Record<string, number>>, tileKey: string) {
  const stored = volumes[tileKey];
  return stored === undefined ? DEFAULT_TILE_VOLUME : clampTileVolume(stored);
}

export function isTileListenMuted(volumes: Readonly<Record<string, number>>, tileKey: string) {
  return tileVolumeForKey(volumes, tileKey) === 0;
}

export function applyRemoteTileListenVolume(
  participant: RemoteParticipant,
  kind: TileListenKind,
  tileVolumePercent: number,
  speakersEnabled: boolean
) {
  const volume = speakersEnabled ? clampTileVolume(tileVolumePercent) / 100 : 0;
  participant.setVolume(volume, listenSourceForTileKind(kind));
}

export function applyAllTileListenVolumes(
  room: Room,
  options: {
    speakersEnabled: boolean;
    tileVolumes: Readonly<Record<string, number>>;
  }
) {
  const { speakersEnabled, tileVolumes } = options;

  for (const participant of room.remoteParticipants.values()) {
    applyRemoteTileListenVolume(participant, "participant", tileVolumeForKey(tileVolumes, participant.identity), speakersEnabled);
    applyRemoteTileListenVolume(
      participant,
      "screen-share",
      tileVolumeForKey(tileVolumes, screenShareTileKey(participant.identity)),
      speakersEnabled
    );
    if (participant.identity.startsWith("listening-bot:")) {
      applyRemoteTileListenVolume(participant, "listening", tileVolumeForKey(tileVolumes, `listening:${participant.identity}`), speakersEnabled);
    }
  }
}
