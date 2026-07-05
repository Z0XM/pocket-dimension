import { browser } from "$app/environment";

export const STORAGE_KEYS = {
  lastRoomName: "zeo:last-room-name",
  guestDisplayName: "zeo:guest-display-name",
  micOutputVolume: "zeo:mic-output-volume",
  micInputCutoff: "zeo:mic-input-cutoff",
  audioOutputDeviceId: "zeo:audio-output-device-id",
  tileColor: "zeo:tile-color",
  hideParticipantVideos: "zeo:hide-participant-videos",
  hideNonVideoTiles: "zeo:hide-non-video-tiles",
  disableSpeakingGlows: "zeo:disable-speaking-glows",
  stageLayoutMode: "zeo:stage-layout-mode",
  autoLayoutPreset: "zeo:auto-layout-preset",
  galleryDensity: "zeo:gallery-density",
  sidebarSplitRatio: "zeo:sidebar-split-ratio",
  gesturesEnabled: "zeo:gestures-enabled",
  gestureOverlayVisible: "zeo:gesture-overlay-visible",
} as const;

export const SESSION_KEYS = {
  activeCall: "zeo:active-call",
} as const;

export type ActiveCallSession = {
  slug: string;
  guestName?: string;
  displayName?: string;
  joinedAt: string;
};

export function gridPlacementsKey(slug: string) {
  return `zeo:grid-placements:${slug}`;
}

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

export function readStoredInt(key: string, fallback: number, min: number, max: number) {
  const stored = readStored(key);
  if (!stored) return fallback;
  const parsed = Number.parseInt(stored, 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export function writeStoredInt(key: string, value: number) {
  writeStored(key, String(value));
}

export function readStoredFloat(key: string, fallback: number, min: number, max: number) {
  const stored = readStored(key);
  if (!stored) return fallback;
  const parsed = Number.parseFloat(stored);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export function writeStoredFloat(key: string, value: number) {
  writeStored(key, String(value));
}

export function readActiveCallSession(): ActiveCallSession | null {
  if (!browser) return null;

  try {
    const raw = sessionStorage.getItem(SESSION_KEYS.activeCall);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActiveCallSession;
    if (!parsed.slug || !parsed.joinedAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeActiveCallSession(session: ActiveCallSession) {
  if (!browser) return;

  try {
    sessionStorage.setItem(SESSION_KEYS.activeCall, JSON.stringify(session));
  } catch {
    // Ignore storage failures
  }
}

export function clearActiveCallSession() {
  if (!browser) return;

  try {
    sessionStorage.removeItem(SESSION_KEYS.activeCall);
  } catch {
    // Ignore storage failures
  }
}
