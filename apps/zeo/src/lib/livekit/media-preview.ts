import type { PermissionState } from "./types";
import { buildMediaConstraints } from "./devices";
import { isDeviceInUseError } from "./media-errors";

export type MediaPreviewResult = {
  stream: MediaStream | null;
  permission: PermissionState;
  cameraInUse: boolean;
};

const emptyResult = (permission: PermissionState, cameraInUse = false): MediaPreviewResult => ({
  stream: null,
  permission,
  cameraInUse,
});

export async function startMediaPreview(options: {
  audio: boolean;
  video: boolean;
  audioDeviceId?: string;
  videoDeviceId?: string;
}): Promise<MediaPreviewResult> {
  if (!navigator.mediaDevices?.getUserMedia) {
    return emptyResult("unavailable");
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia(
      await buildMediaConstraints({
        audio: options.audio,
        video: options.video,
        audioDeviceId: options.audioDeviceId,
        videoDeviceId: options.videoDeviceId,
      })
    );
    return { stream, permission: "granted", cameraInUse: false };
  } catch (error) {
    if (error instanceof DOMException && error.name === "NotAllowedError") {
      return emptyResult("denied");
    }

    if (options.video && options.audio) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(
          await buildMediaConstraints({
            audio: options.audio,
            video: false,
            audioDeviceId: options.audioDeviceId,
            videoDeviceId: options.videoDeviceId,
          })
        );
        return { stream, permission: "granted", cameraInUse: isDeviceInUseError(error) };
      } catch {
        // Fall through to generic unavailable handling.
      }
    }

    if (options.video && isDeviceInUseError(error)) {
      return emptyResult("unavailable", true);
    }

    return emptyResult("unavailable");
  }
}

export async function restartMediaPreview(
  current: MediaStream | null,
  options: {
    audio: boolean;
    video: boolean;
    audioDeviceId?: string;
    videoDeviceId?: string;
  }
) {
  stopMediaPreview(current);
  return startMediaPreview(options);
}

export function stopMediaPreview(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

export function syncPreviewTracks(stream: MediaStream | null, options: { audio: boolean; video: boolean }) {
  if (!stream) return;
  for (const track of stream.getAudioTracks()) {
    track.enabled = options.audio;
  }
  for (const track of stream.getVideoTracks()) {
    track.enabled = options.video;
  }
}
