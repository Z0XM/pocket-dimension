/** Shared (client + server) types and pure helpers for the personal catalogue queue. */

export type CatalogPlaybackState = "idle" | "playing" | "paused";
export type CatalogQueueItemSource = "play" | "next" | "queue" | "last" | "bulk";
/** `play` = play now, `next` = right after the playhead, `queue` = after earlier “Add to queue” rows, `last` = end. */
export type EnqueueMode = "play" | "next" | "queue" | "last";

export const ENQUEUE_MODES: readonly EnqueueMode[] = ["play", "next", "queue", "last"];
export const MAX_CATALOG_QUEUE_ITEMS = 1000;
/** Upper bound for “Add all filtered” / playlist loads in one request. */
export const MAX_BULK_ENQUEUE = 500;
/** “Previous” restarts the current track instead when it has played longer than this. */
export const PREVIOUS_RESTART_THRESHOLD_MS = 3000;

export type CatalogQueueItem = {
  id: string;
  mediaAssetId: string;
  position: number;
  source: string;
  title: string;
  artists: string | null;
  durationMs: number | null;
  playable: boolean;
};

export type CatalogQueueState = {
  id: string;
  playbackState: CatalogPlaybackState;
  currentItemId: string | null;
  positionMs: number;
  positionUpdatedAt: string;
  playbackGeneration: number;
  createdAt: string;
  updatedAt: string;
};

export type CatalogDevice = {
  deviceId: string;
  label: string;
  outputEnabled: boolean;
  volume: number;
  online: boolean;
  lastSeenAt: string;
};

export type CatalogQueueSnapshot = {
  /** Per-process monotonic counter; clients drop snapshots older than the last applied one. */
  seq: number;
  serverNow: string;
  queue: CatalogQueueState | null;
  items: CatalogQueueItem[];
  devices: CatalogDevice[];
};

export type CatalogQueueRunSummary = {
  id: string;
  status: "active" | "ended";
  trackCount: number;
  /** 0-based index of the playhead, or null when finished / never started. */
  currentIndex: number | null;
  positionMs: number;
  titles: string[];
  createdAt: string;
  updatedAt: string;
  endedAt: string | null;
};

/** One ordered row of a History catalogue-queue run (read-only track list). */
export type CatalogQueueRunTrack = {
  id: string;
  mediaAssetId: string;
  position: number;
  title: string | null;
  artists: string | null;
  /** False when the media row is gone (or otherwise unreadable) — show a placeholder title. */
  available: boolean;
};

/** Label for a History run track; never throws on missing/deleted media. */
export function runTrackDisplayTitle(track: { title: string | null; available: boolean }): string {
  if (!track.available) return "Title unavailable";
  const title = track.title?.trim();
  return title || "Title unknown";
}

export function isEnqueueMode(value: unknown): value is EnqueueMode {
  return typeof value === "string" && (ENQUEUE_MODES as readonly string[]).includes(value);
}

/** Index at which new rows are inserted into the ordered queue for `mode`. */
export function insertionIndex(items: { id: string; source: string }[], currentItemId: string | null, mode: EnqueueMode): number {
  const currentIdx = currentItemId ? items.findIndex((i) => i.id === currentItemId) : -1;
  if (mode === "last" || currentIdx < 0) return items.length;
  let idx = currentIdx + 1;
  if (mode === "queue") {
    while (idx < items.length && items[idx]!.source === "queue") idx++;
  }
  return idx;
}

export function spliceIds(order: string[], index: number, ids: string[]): string[] {
  const at = Math.min(Math.max(index, 0), order.length);
  return [...order.slice(0, at), ...ids, ...order.slice(at)];
}

/** A reorder request must be a permutation of the current ids. */
export function isPermutation(current: string[], next: string[]): boolean {
  if (current.length !== next.length) return false;
  const want = new Set(current);
  if (want.size !== current.length) return false;
  const seen = new Set<string>();
  for (const id of next) {
    if (!want.has(id) || seen.has(id)) return false;
    seen.add(id);
  }
  return true;
}

export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= list.length) return list;
  const next = [...list];
  const [row] = next.splice(from, 1);
  next.splice(Math.min(Math.max(to, 0), next.length), 0, row!);
  return next;
}

export function neighbourId(items: { id: string }[], currentItemId: string | null, delta: 1 | -1): string | null {
  if (!currentItemId) return null;
  const idx = items.findIndex((i) => i.id === currentItemId);
  if (idx < 0) return null;
  return items[idx + delta]?.id ?? null;
}

/** Server-authoritative playhead extrapolated to `nowMs`, clamped to the track length when known. */
export function estimatePositionMs(
  state: { playbackState: CatalogPlaybackState; positionMs: number; positionUpdatedAt: string | Date },
  nowMs: number,
  durationMs?: number | null
): number {
  let pos = state.positionMs;
  if (state.playbackState === "playing") {
    const base = new Date(state.positionUpdatedAt).getTime();
    if (Number.isFinite(base)) pos += Math.max(0, nowMs - base);
  }
  pos = Math.max(0, pos);
  if (durationMs && durationMs > 0) pos = Math.min(pos, durationMs);
  return Math.round(pos);
}

/** Order-preserving dedupe — freehand playlists hold each track once. */
export function dedupeIds(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

const DEVICE_ID_RE = /^[A-Za-z0-9-]{8,64}$/;

export function isValidDeviceId(value: unknown): value is string {
  return typeof value === "string" && DEVICE_ID_RE.test(value);
}

/** Short human label from a user agent, e.g. “Chrome · macOS”. */
export function deviceLabelFromUserAgent(ua: string | null | undefined): string {
  const s = ua ?? "";
  const browser = /Edg\//.test(s)
    ? "Edge"
    : /OPR\/|Opera/.test(s)
      ? "Opera"
      : /Firefox\//.test(s)
        ? "Firefox"
        : /Chrome\/|CriOS\//.test(s)
          ? "Chrome"
          : /Safari\//.test(s)
            ? "Safari"
            : "Browser";
  const os = /iPhone|iPad|iPod/.test(s)
    ? "iOS"
    : /Android/.test(s)
      ? "Android"
      : /Mac OS X|Macintosh/.test(s)
        ? "macOS"
        : /Windows/.test(s)
          ? "Windows"
          : /CrOS/.test(s)
            ? "ChromeOS"
            : /Linux/.test(s)
              ? "Linux"
              : "";
  return os ? `${browser} · ${os}` : browser;
}

/**
 * Output default for a newly seen device: on when no other online device already plays audio,
 * so opening Zap on a second device does not double the sound.
 */
export function defaultOutputEnabled(otherOnlineDevices: { outputEnabled: boolean }[]): boolean {
  return !otherOnlineDevices.some((d) => d.outputEnabled);
}

export function clampVolume(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.min(100, Math.max(0, Math.round(n)));
}

export function formatClock(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return "0:00";
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}
