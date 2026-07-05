export const CAMERA_IN_USE_MESSAGE = "Camera is in use by another app. Close other apps using your camera and try again.";

export const MICROPHONE_IN_USE_MESSAGE = "Microphone is in use by another app. Close other apps using your mic and try again.";

export const DEVICE_UNAVAILABLE_MESSAGE = "That device is unavailable. Try another device or reconnect it.";

export function deviceErrorMessage(error: unknown, kind: "camera" | "microphone") {
  if (isDeviceInUseError(error)) {
    return kind === "camera" ? CAMERA_IN_USE_MESSAGE : MICROPHONE_IN_USE_MESSAGE;
  }

  if (error instanceof DOMException) {
    if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
      return `No ${kind} found. Connect a ${kind} and try again.`;
    }
    if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
      return `${kind === "camera" ? "Camera" : "Microphone"} permission was denied.`;
    }
  }

  return DEVICE_UNAVAILABLE_MESSAGE;
}

export function isDeviceInUseError(error: unknown): boolean {
  if (!(error instanceof DOMException)) return false;

  if (error.name === "NotReadableError" || error.name === "TrackStartError") {
    return true;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes("in use") ||
    message.includes("device in use") ||
    message.includes("could not start video source") ||
    message.includes("could not start audio source") ||
    message.includes("failed to allocate videosource") ||
    message.includes("failed to allocate audiosource")
  );
}
