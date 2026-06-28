import { browser } from "$app/environment";

export const STORAGE_KEYS = {
  lastRoomName: "zeo:last-room-name",
  guestDisplayName: "zeo:guest-display-name",
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
