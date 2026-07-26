import {
  createAudioAnalyser,
  DisconnectReason,
  Room,
  RoomEvent,
  Track,
  type ConnectionQuality,
  type LocalAudioTrack,
  type LocalParticipant,
  type RemoteAudioTrack,
  type RemoteParticipant,
} from "livekit-client";
import type { MicGateProcessor } from "./mic-gate-processor";
import {
  DEFAULT_AUDIO_QUALITY,
  DEFAULT_VIDEO_QUALITY,
  roomOptionsForMediaQuality,
  type AudioQualityOption,
  type VideoQualityOption,
} from "./media-quality";
import {
  attachAllRemoteAudioTracks,
  attachRemoteAudioTrack,
  detachAllRemoteAudioTracks,
  detachRemoteAudioTrack,
  reapplyRoomAudioOutput,
} from "./remote-audio";
import { screenShareTileKey } from "./screen-share";

export type ConnectionPhase = "idle" | "connecting" | "connected" | "reconnecting" | "disconnected";

export type CallRoomHandlers = {
  onPhaseChange: (phase: ConnectionPhase) => void;
  onActiveSpeaker: (identity: string | null) => void;
  onAudioLevelsChange?: (levels: Record<string, number>) => void;
  onParticipantsChange: () => void;
  onDisconnect: (reason?: DisconnectReason) => void;
  onConnectionQuality?: (quality: ConnectionQuality, identity: string) => void;
  onMicGateFallback?: () => void;
  onAudioPlaybackStatusChanged?: (canPlayback: boolean) => void;
};

/** Prime autoplay while the join click gesture is still active (before network I/O). */
export function primeBrowserAudioGesture(stream?: MediaStream | null) {
  if (typeof window === "undefined") return;

  const audioTrack = stream?.getAudioTracks().find((track) => track.readyState === "live");
  if (!audioTrack) {
    return;
  }

  const element = new Audio();
  element.srcObject = new MediaStream([audioTrack]);
  element.volume = 0;
  element.muted = true;
  void element.play().catch(() => undefined);
}

/** Resume LiveKit playback and the shared AudioContext used for remote audio + mic processing. */
export async function ensureRoomAudio(room: Room, reason = "unspecified") {
  if (room.state !== "connected") {
    return false;
  }

  try {
    await room.startAudio();
    return room.canPlaybackAudio;
  } catch {
    return room.canPlaybackAudio;
  }
}

type ScreenShareLevelAnalyser = {
  trackSid: string;
  calculateVolume: () => number;
  cleanup: () => Promise<void>;
};

const screenShareLevelAnalysers = new Map<string, ScreenShareLevelAnalyser>();

function readScreenShareAudioLevel(participant: LocalParticipant | RemoteParticipant): number {
  const publication = participant.getTrackPublication(Track.Source.ScreenShareAudio);
  const track = publication?.track;
  if (!track || publication?.isMuted || track.kind !== Track.Kind.Audio) {
    return 0;
  }

  const key = screenShareTileKey(participant.identity);
  const trackSid = track.sid || track.mediaStreamTrack?.id || key;
  const existing = screenShareLevelAnalysers.get(key);
  if (existing && existing.trackSid === trackSid) {
    try {
      return Math.min(1, Math.max(0, existing.calculateVolume()));
    } catch {
      return 0;
    }
  }

  if (existing) {
    void existing.cleanup();
    screenShareLevelAnalysers.delete(key);
  }

  try {
    const analyser = createAudioAnalyser(track as LocalAudioTrack | RemoteAudioTrack, {
      fftSize: 32,
      smoothingTimeConstant: 0.2,
    });
    const trackSid = track.sid || track.mediaStreamTrack?.id || key;
    screenShareLevelAnalysers.set(key, {
      trackSid,
      calculateVolume: analyser.calculateVolume,
      cleanup: analyser.cleanup,
    });
    return Math.min(1, Math.max(0, analyser.calculateVolume()));
  } catch {
    return 0;
  }
}

function cleanupScreenShareLevelAnalysers(activeKeys?: ReadonlySet<string>) {
  for (const [key, analyser] of screenShareLevelAnalysers) {
    if (activeKeys && activeKeys.has(key)) continue;
    void analyser.cleanup();
    screenShareLevelAnalysers.delete(key);
  }
}

export function collectAudioLevels(room: Room): Record<string, number> {
  const levels: Record<string, number> = {
    [room.localParticipant.identity]: room.localParticipant.audioLevel,
  };
  const activeScreenShareKeys = new Set<string>();

  const localScreenKey = screenShareTileKey(room.localParticipant.identity);
  const localScreenLevel = readScreenShareAudioLevel(room.localParticipant);
  if (localScreenLevel > 0 || room.localParticipant.getTrackPublication(Track.Source.ScreenShareAudio)?.track) {
    levels[localScreenKey] = localScreenLevel;
    activeScreenShareKeys.add(localScreenKey);
  }

  for (const participant of room.remoteParticipants.values()) {
    levels[participant.identity] = participant.audioLevel;
    const screenKey = screenShareTileKey(participant.identity);
    const screenLevel = readScreenShareAudioLevel(participant);
    if (screenLevel > 0 || participant.getTrackPublication(Track.Source.ScreenShareAudio)?.track) {
      levels[screenKey] = screenLevel;
      activeScreenShareKeys.add(screenKey);
    }
  }

  cleanupScreenShareLevelAnalysers(activeScreenShareKeys);
  return levels;
}

const AUDIO_LEVEL_EPSILON = 0.005;

function audioLevelsChanged(previous: Record<string, number>, next: Record<string, number>) {
  const identities = new Set([...Object.keys(previous), ...Object.keys(next)]);

  for (const identity of identities) {
    if (Math.abs((previous[identity] ?? 0) - (next[identity] ?? 0)) > AUDIO_LEVEL_EPSILON) {
      return true;
    }
  }

  return false;
}

function getLocalMicTrack(room: Room): LocalAudioTrack | undefined {
  const track = room.localParticipant.getTrackPublication(Track.Source.Microphone)?.track;
  if (!track || track.kind !== Track.Kind.Audio) return undefined;
  return track as LocalAudioTrack;
}

/** Attach after publish — LiveKit sets audioContext on the track only after createLocalTracks returns. */
export async function attachMicGateProcessor(room: Room, processor: MicGateProcessor) {
  const track = getLocalMicTrack(room);
  if (!track) {
    throw new Error("Local microphone track is unavailable");
  }

  await track.setProcessor(processor);
}

async function enableMicrophone(
  room: Room,
  enabled: boolean,
  options: {
    audioDeviceId?: string;
    micGateProcessor?: MicGateProcessor;
  },
  onMicGateFallback?: () => void
) {
  await room.localParticipant.setMicrophoneEnabled(enabled, {
    deviceId: options.audioDeviceId,
  });

  if (!enabled || !options.micGateProcessor) {
    return;
  }

  try {
    await attachMicGateProcessor(room, options.micGateProcessor);
  } catch {
    const track = getLocalMicTrack(room);
    try {
      await track?.stopProcessor();
    } catch {
      // Keep the raw microphone track if processor teardown fails.
    }
    onMicGateFallback?.();
  }
}

export function createCallRoom(
  handlers: CallRoomHandlers,
  mediaQuality: {
    videoQuality?: VideoQualityOption;
    audioQuality?: AudioQualityOption;
  } = {}
) {
  const room = new Room(
    roomOptionsForMediaQuality(mediaQuality.videoQuality ?? DEFAULT_VIDEO_QUALITY, mediaQuality.audioQuality ?? DEFAULT_AUDIO_QUALITY)
  );

  let audioLevelFrame: number | null = null;
  let lastAudioLevels: Record<string, number> = {};

  function stopAudioLevelPolling() {
    if (audioLevelFrame !== null) {
      cancelAnimationFrame(audioLevelFrame);
      audioLevelFrame = null;
    }
    lastAudioLevels = {};
    cleanupScreenShareLevelAnalysers();
  }

  function publishAudioLevels(force = false) {
    const levels = collectAudioLevels(room);
    if (!force && !audioLevelsChanged(lastAudioLevels, levels)) {
      return;
    }

    lastAudioLevels = levels;
    handlers.onAudioLevelsChange?.(levels);
  }

  function startAudioLevelPolling() {
    stopAudioLevelPolling();

    const tick = () => {
      publishAudioLevels();
      audioLevelFrame = requestAnimationFrame(tick);
    };

    publishAudioLevels(true);
    audioLevelFrame = requestAnimationFrame(tick);
  }

  room.on(RoomEvent.Reconnecting, () => handlers.onPhaseChange("reconnecting"));
  room.on(RoomEvent.Reconnected, () => {
    handlers.onPhaseChange("connected");
    attachAllRemoteAudioTracks(room);
    void ensureRoomAudio(room, "reconnected");
  });
  room.on(RoomEvent.Disconnected, (reason) => {
    stopAudioLevelPolling();
    detachAllRemoteAudioTracks(room);
    handlers.onPhaseChange("disconnected");
    handlers.onDisconnect(reason);
  });
  room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
    handlers.onActiveSpeaker(speakers[0]?.identity ?? null);
    publishAudioLevels(true);
  });
  room.on(RoomEvent.ParticipantConnected, () => handlers.onParticipantsChange());
  room.on(RoomEvent.ParticipantDisconnected, () => handlers.onParticipantsChange());
  room.on(RoomEvent.TrackSubscribed, (track) => {
    handlers.onParticipantsChange();
    if (track.kind === Track.Kind.Audio) {
      attachRemoteAudioTrack(track);
      void reapplyRoomAudioOutput(room).then(() => ensureRoomAudio(room, "track_subscribed"));
    }
  });
  room.on(RoomEvent.TrackUnsubscribed, (track) => {
    handlers.onParticipantsChange();
    if (track.kind === Track.Kind.Audio) {
      detachRemoteAudioTrack(track);
    }
  });
  room.on(RoomEvent.AudioPlaybackStatusChanged, (canPlayback) => {
    handlers.onAudioPlaybackStatusChanged?.(canPlayback);
  });
  room.on(RoomEvent.LocalTrackPublished, () => handlers.onParticipantsChange());
  room.on(RoomEvent.LocalTrackUnpublished, () => handlers.onParticipantsChange());
  room.on(RoomEvent.ConnectionQualityChanged, (quality, participant) => {
    handlers.onConnectionQuality?.(quality, participant.identity);
  });

  async function connect(
    wsUrl: string,
    token: string,
    options: {
      micEnabled: boolean;
      camEnabled: boolean;
      iceServers?: RTCIceServer[];
      audioDeviceId?: string;
      videoDeviceId?: string;
      audioOutputDeviceId?: string;
      micGateProcessor?: MicGateProcessor;
    }
  ) {
    handlers.onPhaseChange("connecting");
    await room.connect(wsUrl, token, options.iceServers?.length ? { rtcConfig: { iceServers: options.iceServers } } : undefined);
    await ensureRoomAudio(room, "connect");
    await enableMicrophone(
      room,
      options.micEnabled,
      {
        audioDeviceId: options.audioDeviceId,
        micGateProcessor: options.micGateProcessor,
      },
      handlers.onMicGateFallback
    );
    await room.localParticipant.setCameraEnabled(options.camEnabled, {
      deviceId: options.videoDeviceId,
    });
    try {
      await reapplyRoomAudioOutput(room, options.audioOutputDeviceId);
    } catch {
      // Output device switching is best-effort.
    }
    attachAllRemoteAudioTracks(room);
    await ensureRoomAudio(room, "connect_complete");
    handlers.onPhaseChange("connected");
    handlers.onParticipantsChange();
    startAudioLevelPolling();
  }

  async function disconnect() {
    stopAudioLevelPolling();
    detachAllRemoteAudioTracks(room);
    // Release capture devices promptly (camera indicator) before/while disconnect settles.
    try {
      await room.localParticipant.setCameraEnabled(false);
    } catch {
      // Best-effort — disconnect below still tears down the room.
    }
    try {
      await room.localParticipant.setMicrophoneEnabled(false);
    } catch {
      // Best-effort.
    }
    for (const publication of room.localParticipant.trackPublications.values()) {
      publication.track?.stop();
    }
    if (room.state !== "disconnected") {
      await room.disconnect();
    }
  }

  return { room, connect, disconnect };
}

export function listRoomParticipants(room: Room): Array<LocalParticipant | RemoteParticipant> {
  return [room.localParticipant, ...room.remoteParticipants.values()];
}

export function setRoomSpeakerMuted(room: Room, muted: boolean) {
  const volume = muted ? 0 : 1;

  for (const participant of room.remoteParticipants.values()) {
    participant.setVolume(volume);
    participant.setVolume(volume, Track.Source.ScreenShareAudio);
  }
}

export function isCameraEnabled(participant: LocalParticipant | RemoteParticipant) {
  return participant.isCameraEnabled;
}

export function isMicrophoneEnabled(participant: LocalParticipant | RemoteParticipant) {
  return participant.isMicrophoneEnabled;
}

export function wasRoomDeleted(reason?: DisconnectReason) {
  return reason === DisconnectReason.ROOM_DELETED;
}

export function wasParticipantRemoved(reason?: DisconnectReason) {
  return reason === DisconnectReason.PARTICIPANT_REMOVED;
}
