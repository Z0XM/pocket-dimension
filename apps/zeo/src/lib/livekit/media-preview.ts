import type { PermissionState } from "./types";

export async function startMediaPreview(options: { audio: boolean; video: boolean }) {
  if (!navigator.mediaDevices?.getUserMedia) {
    return { stream: null as MediaStream | null, permission: "unavailable" as PermissionState };
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: options.audio,
      video: options.video,
    });
    return { stream, permission: "granted" as PermissionState };
  } catch (error) {
    if (error instanceof DOMException && error.name === "NotAllowedError") {
      return { stream: null, permission: "denied" as PermissionState };
    }
    return { stream: null, permission: "unavailable" as PermissionState };
  }
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
