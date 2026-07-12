import { browser } from "$app/environment";
import { Room, Track, type RemoteAudioTrack, type Room as LiveKitRoom } from "livekit-client";

export type AudioDiagLevel = "info" | "warn" | "error";

export type AudioDiagEvent = {
  ts: string;
  level: AudioDiagLevel;
  event: string;
  detail?: Record<string, unknown>;
};

const MAX_EVENTS = 120;
const events: AudioDiagEvent[] = [];

function pushEvent(level: AudioDiagLevel, event: string, detail?: Record<string, unknown>) {
  const entry: AudioDiagEvent = {
    ts: new Date().toISOString(),
    level,
    event,
    detail,
  };

  events.push(entry);
  if (events.length > MAX_EVENTS) {
    events.shift();
  }

  const payload = detail ? { ...detail } : undefined;
  if (level === "error") {
    console.error(`[zeo-audio] ${event}`, payload ?? "");
  } else if (level === "warn") {
    console.warn(`[zeo-audio] ${event}`, payload ?? "");
  } else {
    console.info(`[zeo-audio] ${event}`, payload ?? "");
  }
}

export function logAudioDiag(level: AudioDiagLevel, event: string, detail?: Record<string, unknown>) {
  if (!browser) return;
  pushEvent(level, event, detail);
}

export function getAudioDiagnostics() {
  return [...events];
}

export function clearAudioDiagnostics() {
  events.length = 0;
}

export function formatAudioDiagnostics() {
  return JSON.stringify(
    {
      capturedAt: new Date().toISOString(),
      events: getAudioDiagnostics(),
    },
    null,
    2
  );
}

export async function copyAudioDiagnostics() {
  const text = formatAudioDiagnostics();
  await navigator.clipboard.writeText(text);
  return text;
}

export function snapshotRoomAudio(room: LiveKitRoom, label: string) {
  const remoteAudio = [...room.remoteParticipants.values()].flatMap((participant) =>
    [...participant.audioTrackPublications.values()].map((publication) => ({
      identity: participant.identity,
      source: publication.source,
      subscribed: publication.isSubscribed,
      muted: publication.isMuted,
      trackSid: publication.trackSid,
      attachedElements: publication.track?.attachedElements.length ?? 0,
      volume: publication.track?.kind === Track.Kind.Audio ? (publication.track as RemoteAudioTrack).getVolume() : undefined,
    }))
  );

  const micPublication = room.localParticipant.getTrackPublication(Track.Source.Microphone);

  const micTrack = micPublication?.track;

  logAudioDiag("info", "room.audio_snapshot", {
    label,
    roomState: room.state,
    canPlaybackAudio: room.canPlaybackAudio,
    localMicEnabled: room.localParticipant.isMicrophoneEnabled,
    localMicMuted: micPublication?.isMuted,
    localMicTrackSid: micPublication?.trackSid,
    localMicTrackKind: micTrack?.kind,
    remoteParticipantCount: room.remoteParticipants.size,
    remoteAudio,
  });
}

export function installAudioDiagnosticsConsoleApi() {
  if (!browser) return;

  const api = {
    dump: () => console.log(formatAudioDiagnostics()),
    get: getAudioDiagnostics,
    clear: clearAudioDiagnostics,
    copy: copyAudioDiagnostics,
    snapshot: (room: Room, label = "manual") => snapshotRoomAudio(room, label),
  };

  (window as Window & { __zeoAudioDiag?: typeof api }).__zeoAudioDiag = api;
}
