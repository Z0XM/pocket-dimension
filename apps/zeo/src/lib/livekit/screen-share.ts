import { Track, type LocalParticipant, type RemoteParticipant, type Room, type ScreenShareCaptureOptions } from "livekit-client";
import { logAudioDiag } from "./call-audio-diagnostics";
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

function screenShareAudioPublished(local: LocalParticipant) {
  return isScreenShareAudioActive(local);
}

export function findScreenShareParticipant(room: Room, excludeIdentity?: string) {
  for (const participant of listRoomParticipants(room)) {
    if (excludeIdentity && participant.identity === excludeIdentity) continue;
    if (isScreenShareActive(participant)) return participant;
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

export function screenShareFailureMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === "NotAllowedError") {
    return "Screen sharing was cancelled";
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

export async function enableLocalScreenShare(local: LocalParticipant): Promise<ScreenShareStartResult> {
  const unavailable = screenShareUnavailableReason();
  if (unavailable) {
    throw new Error(unavailable);
  }

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

      logAudioDiag("info", "screen_share.started", {
        attempt: attempt.label,
        audioPublished,
        audioFallback,
      });

      return { audioPublished, audioFallback };
    } catch (error) {
      lastError = error;
      if (!isRetriableScreenShareError(error)) {
        throw error;
      }

      logAudioDiag("warn", "screen_share.attempt_failed", {
        attempt: attempt.label,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Could not start screen share");
}

export async function disableLocalScreenShare(local: LocalParticipant) {
  await local.setScreenShareEnabled(false);
  logAudioDiag("info", "screen_share.stopped");
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
