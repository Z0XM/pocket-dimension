import { browser } from "$app/environment";

export const STORAGE_KEYS = {
  lastRoomName: "zeo:last-room-name",
  guestDisplayName: "zeo:guest-display-name",
  micOutputVolume: "zeo:mic-output-volume",
  micInputCutoff: "zeo:mic-input-cutoff",
  audioOutputDeviceId: "zeo:audio-output-device-id",
  tileColor: "zeo:tile-color",
  hideParticipantVideos: "zeo:hide-participant-videos",
  disableSpeakingGlows: "zeo:disable-speaking-glows",
} as const;

export function readStored(key: string): string | null {
  if (!browser) return null;

  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStored(key: string, value: string) {
  if (!browser) return;

  const trimmed = value.trim();
  try {
    if (trimmed) {
      localStorage.setItem(key, trimmed);
    } else {
      localStorage.removeItem(key);
    }
  } catch {
    // Private browsing or storage quota — ignore
  }
}

export function readStoredFlag(key: string, defaultValue = false): boolean {
  const stored = readStored(key);
  if (stored === "true") return true;
  if (stored === "false") return false;
  return defaultValue;
}

export function writeStoredFlag(key: string, value: boolean) {
  writeStored(key, value ? "true" : "false");
}
