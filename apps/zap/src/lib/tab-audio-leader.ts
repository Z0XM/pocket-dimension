/**
 * Same-browser tab leader election for catalogue audio output.
 *
 * Tabs share one `zap.deviceId` (localStorage) so the Devices panel treats them as one
 * browser — but each tab mounts its own <audio>. Without a leader, both emit sound.
 *
 * Primary: Web Locks API (exclusive lock held by the speaking tab).
 * Fallback: BroadcastChannel + localStorage heartbeat (visibility-preferring).
 *
 * Cross-device sync is unchanged: phone/desktop use different deviceIds.
 */

const LOCK_NAME = "zap-catalog-audio-output";
const BC_NAME = "zap-catalog-audio-leader";
const STORAGE_KEY = "zap.catalogAudioLeader";
const TAB_ID_KEY = "zap.catalogAudioTabId";
const HEARTBEAT_MS = 700;
const STALE_MS = 2200;

export type TabAudioLeaderStop = () => void;

type LeaderClaim = {
  tabId: string;
  at: number;
  visible: boolean;
};

function readTabId(): string {
  try {
    const existing = sessionStorage.getItem(TAB_ID_KEY);
    if (existing && /^[A-Za-z0-9-]{8,64}$/.test(existing)) return existing;
    const next = crypto.randomUUID();
    sessionStorage.setItem(TAB_ID_KEY, next);
    return next;
  } catch {
    return crypto.randomUUID();
  }
}

function readClaim(): LeaderClaim | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LeaderClaim;
    if (!parsed?.tabId || typeof parsed.at !== "number") return null;
    return { tabId: parsed.tabId, at: parsed.at, visible: Boolean(parsed.visible) };
  } catch {
    return null;
  }
}

function writeClaim(claim: LeaderClaim) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(claim));
  } catch {
    // ignore quota / private mode
  }
}

/** Pure election: prefer a fresh visible claim, else the freshest non-stale claim. */
export function pickLeaderTabId(self: LeaderClaim, peers: LeaderClaim[], now = Date.now()): string {
  const fresh = [self, ...peers].filter((c) => now - c.at <= STALE_MS);
  if (fresh.length === 0) return self.tabId;
  const visible = fresh.filter((c) => c.visible);
  const pool = visible.length > 0 ? visible : fresh;
  pool.sort((a, b) => b.at - a.at || a.tabId.localeCompare(b.tabId));
  return pool[0]!.tabId;
}

function subscribeBroadcastLeader(onChange: (isLeader: boolean) => void): TabAudioLeaderStop {
  const tabId = readTabId();
  const peers = new Map<string, LeaderClaim>();
  let stopped = false;
  let lastLeader = false;

  const emit = (isLeader: boolean) => {
    if (stopped || isLeader === lastLeader) return;
    lastLeader = isLeader;
    onChange(isLeader);
  };

  const selfClaim = (): LeaderClaim => ({
    tabId,
    at: Date.now(),
    visible: typeof document === "undefined" ? true : document.visibilityState === "visible",
  });

  const evaluate = () => {
    const self = selfClaim();
    writeClaim(self);
    const stored = readClaim();
    if (stored && stored.tabId !== tabId) peers.set(stored.tabId, stored);
    const leaderId = pickLeaderTabId(self, [...peers.values()]);
    bc?.postMessage({ type: "claim", claim: self });
    emit(leaderId === tabId);
  };

  let bc: BroadcastChannel | null = null;
  try {
    bc = new BroadcastChannel(BC_NAME);
    bc.onmessage = (ev) => {
      const data = ev.data as { type?: string; claim?: LeaderClaim; tabId?: string };
      if (data?.type === "claim" && data.claim?.tabId && data.claim.tabId !== tabId) {
        peers.set(data.claim.tabId, data.claim);
        evaluate();
      } else if (data?.type === "bye" && data.tabId) {
        peers.delete(data.tabId);
        evaluate();
      }
    };
  } catch {
    bc = null;
  }

  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY || !e.newValue) return;
    try {
      const claim = JSON.parse(e.newValue) as LeaderClaim;
      if (claim?.tabId && claim.tabId !== tabId) {
        peers.set(claim.tabId, claim);
        evaluate();
      }
    } catch {
      // ignore
    }
  };

  const onVisibility = () => evaluate();

  window.addEventListener("storage", onStorage);
  document.addEventListener("visibilitychange", onVisibility);
  const heartbeat = window.setInterval(evaluate, HEARTBEAT_MS);
  evaluate();

  return () => {
    stopped = true;
    window.clearInterval(heartbeat);
    window.removeEventListener("storage", onStorage);
    document.removeEventListener("visibilitychange", onVisibility);
    try {
      bc?.postMessage({ type: "bye", tabId });
      bc?.close();
    } catch {
      // ignore
    }
    const claim = readClaim();
    if (claim?.tabId === tabId) {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
    }
    emit(false);
  };
}

function subscribeWebLocksLeader(onChange: (isLeader: boolean) => void): TabAudioLeaderStop {
  const ac = new AbortController();
  let stopped = false;
  let lastLeader = false;

  const emit = (isLeader: boolean) => {
    if (stopped || isLeader === lastLeader) return;
    lastLeader = isLeader;
    onChange(isLeader);
  };

  emit(false);

  const run = async () => {
    while (!stopped && !ac.signal.aborted) {
      try {
        await navigator.locks!.request(LOCK_NAME, { signal: ac.signal }, async () => {
          emit(true);
          await new Promise<void>((resolve) => {
            if (ac.signal.aborted) {
              resolve();
              return;
            }
            ac.signal.addEventListener("abort", () => resolve(), { once: true });
          });
        });
      } catch {
        // AbortError when stopping, or transient lock failures — retry unless stopped.
      }
      emit(false);
      if (!stopped && !ac.signal.aborted) {
        await new Promise((r) => setTimeout(r, 150));
      }
    }
  };

  void run();

  return () => {
    stopped = true;
    ac.abort();
    emit(false);
  };
}

/**
 * Subscribe to whether this tab should emit catalogue audio.
 * Starts as non-leader until election/lock acquisition succeeds.
 */
export function subscribeTabAudioLeader(onChange: (isLeader: boolean) => void): TabAudioLeaderStop {
  if (typeof window === "undefined") {
    onChange(true);
    return () => {};
  }
  if (typeof navigator !== "undefined" && navigator.locks?.request) {
    return subscribeWebLocksLeader(onChange);
  }
  return subscribeBroadcastLeader(onChange);
}
