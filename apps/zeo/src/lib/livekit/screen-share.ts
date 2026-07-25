import {
  isLocalParticipant,
  Track,
  type LocalParticipant,
  type LocalTrack,
  type RemoteParticipant,
  type Room,
  type ScreenShareCaptureOptions,
} from "livekit-client";
import { listRoomParticipants } from "./room-client";

/** Skip LiveKit's default 1080p ideal constraints — some browsers reject them with NotSupportedError. */
const SCREEN_CAPTURE_VIDEO_ONLY: ScreenShareCaptureOptions = {
  resolution: { width: 0, height: 0 },
};

const SCREEN_CAPTURE_WITH_TAB_AUDIO: ScreenShareCaptureOptions = {
  ...SCREEN_CAPTURE_VIDEO_ONLY,
  audio: true,
};

const SCREEN_CAPTURE_WITH_SYSTEM_AUDIO: ScreenShareCaptureOptions = {
  ...SCREEN_CAPTURE_WITH_TAB_AUDIO,
  systemAudio: "include",
};

const AUDIO_ONLY_CAPTURE_ATTEMPTS: Array<{ label: string; options: ScreenShareCaptureOptions }> = [
  { label: "system_audio", options: SCREEN_CAPTURE_WITH_SYSTEM_AUDIO },
  { label: "tab_audio", options: SCREEN_CAPTURE_WITH_TAB_AUDIO },
];

/** Unpublished display-capture video kept alive so tab/system audio can continue (legacy audio-only path). */
const heldScreenCaptureVideoTracks = new WeakMap<LocalParticipant, LocalTrack>();

export type ScreenShareStartResult = {
  audioPublished: boolean;
  audioFallback: "published" | "picker_skipped" | "browser_unsupported";
};

export function isScreenShareActive(participant: LocalParticipant | RemoteParticipant) {
  const publication = participant.getTrackPublication(Track.Source.ScreenShare);
  return Boolean(publication?.track && !publication.isMuted);
}

export function isScreenShareAudioActive(participant: LocalParticipant | RemoteParticipant) {
  const publication = participant.getTrackPublication(Track.Source.ScreenShareAudio);
  return Boolean(publication?.track && !publication.isMuted);
}

export function isScreenShareAudioOnlyActive(participant: LocalParticipant | RemoteParticipant) {
  return isScreenShareAudioActive(participant) && !isScreenShareActive(participant);
}

function hasScreenSharePublication(participant: LocalParticipant | RemoteParticipant) {
  return Boolean(participant.getTrackPublication(Track.Source.ScreenShare)?.track);
}

function hasScreenShareAudioPublication(participant: LocalParticipant | RemoteParticipant) {
  return Boolean(participant.getTrackPublication(Track.Source.ScreenShareAudio)?.track);
}

function hasHeldScreenCaptureVideo(local: LocalParticipant) {
  return heldScreenCaptureVideoTracks.has(local);
}

/** True while any screen/display capture media is still held or published (including muted). */
export function isScreenCaptureActive(participant: LocalParticipant | RemoteParticipant) {
  if (hasScreenSharePublication(participant) || hasScreenShareAudioPublication(participant)) {
    return true;
  }

  // Local-only held video from the legacy audio-only capture path.
  return isLocalParticipant(participant) && hasHeldScreenCaptureVideo(participant);
}

function screenShareAudioPublished(local: LocalParticipant) {
  return isScreenShareAudioActive(local);
}

export function findScreenShareParticipant(room: Room, excludeIdentity?: string) {
  return findScreenCaptureParticipant(room, excludeIdentity);
}

export function findScreenCaptureParticipant(room: Room, excludeIdentity?: string) {
  for (const participant of listRoomParticipants(room)) {
    if (excludeIdentity && participant.identity === excludeIdentity) continue;
    if (isScreenCaptureActive(participant)) return participant;
  }
  return null;
}

export const SCREEN_SHARE_TILE_PREFIX = "screen-share:";

export function screenShareTileKey(participantIdentity: string) {
  return `${SCREEN_SHARE_TILE_PREFIX}${participantIdentity}`;
}

export function isScreenShareTileKey(key: string) {
  return key.startsWith(SCREEN_SHARE_TILE_PREFIX);
}

export function displayNameForParticipant(participant: LocalParticipant | RemoteParticipant, localIdentity: string, localDisplayName: string) {
  if (participant.identity === localIdentity) return localDisplayName;
  return participant.name || "Participant";
}

export function screenShareUnavailableReason(): string | null {
  if (typeof window === "undefined") return "Screen sharing is not available here";

  if (!window.isSecureContext) {
    return "Screen sharing requires HTTPS or localhost";
  }

  if (typeof navigator.mediaDevices?.getDisplayMedia !== "function") {
    return "Your browser does not support screen sharing";
  }

  return null;
}

function isRetriableScreenShareError(error: unknown) {
  if (error instanceof DOMException) {
    return error.name === "NotSupportedError" || error.name === "OverconstrainedError";
  }
  return error instanceof Error && error.message.toLowerCase().includes("not supported");
}

function isMissingScreenShareAudioError(error: unknown) {
  return error instanceof Error && error.message === "screen_share_audio_missing";
}

export function screenShareFailureMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === "NotAllowedError") {
    return "Screen sharing was cancelled";
  }

  if (isMissingScreenShareAudioError(error)) {
    return "Enable Share audio in the browser picker to share tab sound only";
  }

  if (error instanceof Error && error.message === "screen_share_audio_unavailable") {
    return "Share audio was not granted in the browser picker — stop and share again with audio enabled";
  }

  const unavailable = screenShareUnavailableReason();
  if (unavailable) return unavailable;

  if (isRetriableScreenShareError(error)) {
    return "Screen sharing is not available in this browser window — try Chrome or Firefox on desktop";
  }

  return "Could not start screen share";
}

async function startScreenShare(local: LocalParticipant, options: ScreenShareCaptureOptions) {
  await local.setScreenShareEnabled(true, options);
}

function stopHeldScreenCaptureVideo(local: LocalParticipant) {
  const heldVideo = heldScreenCaptureVideoTracks.get(local);
  if (!heldVideo) return;

  heldVideo.stop();
  heldScreenCaptureVideoTracks.delete(local);
}

async function unpublishScreenShareAudio(local: LocalParticipant) {
  const publication = local.getTrackPublication(Track.Source.ScreenShareAudio);
  if (publication?.track) {
    await local.unpublishTrack(publication.track);
  }
}

export function watchHeldScreenCaptureEnded(local: LocalParticipant, onEnded: () => void) {
  const heldVideo = heldScreenCaptureVideoTracks.get(local);
  const mediaTrack = heldVideo?.mediaStreamTrack;
  if (!mediaTrack) return () => undefined;

  const handleEnded = () => onEnded();
  mediaTrack.addEventListener("ended", handleEnded);
  return () => mediaTrack.removeEventListener("ended", handleEnded);
}

export async function enableLocalScreenShare(local: LocalParticipant): Promise<ScreenShareStartResult> {
  const unavailable = screenShareUnavailableReason();
  if (unavailable) {
    throw new Error(unavailable);
  }

  await disableLocalScreenAudioShare(local);

  const attempts: Array<{ label: string; options: ScreenShareCaptureOptions }> = [
    { label: "system_audio", options: SCREEN_CAPTURE_WITH_SYSTEM_AUDIO },
    { label: "tab_audio", options: SCREEN_CAPTURE_WITH_TAB_AUDIO },
    { label: "video_only", options: SCREEN_CAPTURE_VIDEO_ONLY },
  ];

  let lastError: unknown;

  for (const attempt of attempts) {
    try {
      await startScreenShare(local, attempt.options);
      const audioPublished = screenShareAudioPublished(local);
      const audioFallback = audioPublished ? "published" : attempt.label === "video_only" ? "browser_unsupported" : "picker_skipped";

      return { audioPublished, audioFallback };
    } catch (error) {
      lastError = error;
      if (!isRetriableScreenShareError(error)) {
        throw error;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Could not start screen share");
}

export async function enableLocalScreenAudioShare(local: LocalParticipant): Promise<ScreenShareStartResult> {
  const unavailable = screenShareUnavailableReason();
  if (unavailable) {
    throw new Error(unavailable);
  }

  if (hasScreenSharePublication(local) || isScreenShareActive(local)) {
    await disableLocalScreenShare(local);
  }

  await disableLocalScreenAudioShare(local);

  let lastError: unknown;

  for (const attempt of AUDIO_ONLY_CAPTURE_ATTEMPTS) {
    try {
      const localTracks = await local.createScreenTracks(attempt.options);
      const videoTrack = localTracks.find((track) => track.source === Track.Source.ScreenShare);
      const audioTrack = localTracks.find((track) => track.source === Track.Source.ScreenShareAudio);

      if (videoTrack) {
        heldScreenCaptureVideoTracks.set(local, videoTrack);
      }

      if (!audioTrack) {
        stopHeldScreenCaptureVideo(local);
        throw new Error("screen_share_audio_missing");
      }

      await local.publishTrack(audioTrack);

      return { audioPublished: true, audioFallback: "published" };
    } catch (error) {
      stopHeldScreenCaptureVideo(local);
      lastError = error;
      if (!isRetriableScreenShareError(error) && !isMissingScreenShareAudioError(error)) {
        throw error;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Could not start tab audio share");
}

export async function disableLocalScreenShare(local: LocalParticipant) {
  if (hasScreenSharePublication(local) || isScreenShareActive(local)) {
    await local.setScreenShareEnabled(false);
  }
  stopHeldScreenCaptureVideo(local);
}

export async function disableLocalScreenAudioShare(local: LocalParticipant) {
  await unpublishScreenShareAudio(local);
  stopHeldScreenCaptureVideo(local);
}

/** Full teardown: published (muted or not) tracks + any held capture video. */
export async function disableLocalScreenCapture(local: LocalParticipant) {
  if (hasScreenSharePublication(local) || isScreenShareActive(local)) {
    await local.setScreenShareEnabled(false);
  }
  await unpublishScreenShareAudio(local);
  stopHeldScreenCaptureVideo(local);
}

/** True when display capture granted audio (published, including muted). */
export function isScreenShareAudioAvailable(local: LocalParticipant) {
  return hasScreenShareAudioPublication(local);
}

/**
 * Toggle screen video sharing via mute/unmute when a publication exists.
 * Turning video off with no audio (and no muted audio to keep) stops the whole share.
 */
export async function setLocalScreenShareVideoEnabled(local: LocalParticipant, enabled: boolean) {
  const publication = local.getTrackPublication(Track.Source.ScreenShare);

  if (enabled) {
    if (publication?.track) {
      if (publication.isMuted) {
        await publication.unmute();
      }
      return;
    }

    const heldVideo = heldScreenCaptureVideoTracks.get(local);
    if (heldVideo) {
      await local.publishTrack(heldVideo, { source: Track.Source.ScreenShare });
      heldScreenCaptureVideoTracks.delete(local);
      return;
    }

    await enableLocalScreenShare(local);
    return;
  }

  if (publication?.track && !publication.isMuted) {
    await publication.mute();
  }

  // Both off (no unmuted audio) → full stop, including held tracks.
  if (!isScreenShareAudioActive(local)) {
    await disableLocalScreenCapture(local);
  }
}

/**
 * Toggle screen audio sharing via mute/unmute so it can be turned back on.
 * Turning audio off with no video stops the whole share.
 */
export async function setLocalScreenShareAudioEnabled(local: LocalParticipant, enabled: boolean) {
  const publication = local.getTrackPublication(Track.Source.ScreenShareAudio);

  if (enabled) {
    if (publication?.track) {
      if (publication.isMuted) {
        await publication.unmute();
      }
      return;
    }
    throw new Error("screen_share_audio_unavailable");
  }

  if (publication?.track && !publication.isMuted) {
    await publication.mute();
  }

  if (!isScreenShareActive(local)) {
    await disableLocalScreenCapture(local);
  }
}

/** After a tile toggle, stop sharing if neither video nor audio remains unmuted. */
export async function stopShareIfNoMedia(local: LocalParticipant) {
  if (!isScreenShareActive(local) && !isScreenShareAudioActive(local)) {
    await disableLocalScreenCapture(local);
  }
}

export function screenShareAudioHint(result: ScreenShareStartResult): string | null {
  if (result.audioPublished) {
    return "Screen shared with audio";
  }

  if (result.audioFallback === "browser_unsupported") {
    return "Screen shared without audio — this browser does not support sharing tab or system sound";
  }

  return "Screen shared. Enable Share audio in the browser picker to include tab sound";
}

export function screenShareAudioOnlyHint(result: ScreenShareStartResult): string | null {
  if (result.audioPublished) {
    return "Sharing tab audio only";
  }

  return screenShareAudioHint(result);
}
