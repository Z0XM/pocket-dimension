import { Track, type LocalParticipant, type RemoteParticipant, type Room, type ScreenShareCaptureOptions } from "livekit-client";
import { listRoomParticipants } from "./room-client";

/** Skip LiveKit's default 1080p ideal constraints — some browsers reject them with NotSupportedError. */
const UNCONSTRAINED_SCREEN_CAPTURE: ScreenShareCaptureOptions = {
  resolution: { width: 0, height: 0 },
};

export function isScreenShareActive(participant: LocalParticipant | RemoteParticipant) {
  const publication = participant.getTrackPublication(Track.Source.ScreenShare);
  return Boolean(publication?.track && !publication.isMuted);
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

export async function enableLocalScreenShare(local: LocalParticipant) {
  const unavailable = screenShareUnavailableReason();
  if (unavailable) {
    throw new Error(unavailable);
  }

  try {
    await local.setScreenShareEnabled(true, UNCONSTRAINED_SCREEN_CAPTURE);
    return;
  } catch (error) {
    if (!isRetriableScreenShareError(error)) throw error;
  }

  await local.setScreenShareEnabled(true);
}

export async function disableLocalScreenShare(local: LocalParticipant) {
  await local.setScreenShareEnabled(false);
}
