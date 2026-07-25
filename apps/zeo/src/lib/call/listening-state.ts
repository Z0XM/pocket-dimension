import { writable, type Readable } from "svelte/store";
import type { ListeningSnapshot } from "$lib/server/listening/types";

export type ListeningConnectionState = "idle" | "connecting" | "connected" | "error";

export type ListeningStateStore = {
  snapshot: Readable<ListeningSnapshot | null>;
  connectionState: Readable<ListeningConnectionState>;
  connect: (slug: string) => void;
  disconnect: () => void;
  refresh: (slug: string) => Promise<ListeningSnapshot | null>;
};

const BACKOFF_MS = [1_000, 2_000, 4_000, 8_000, 15_000];

export function createListeningStateStore(): ListeningStateStore {
  const snapshot = writable<ListeningSnapshot | null>(null);
  const connectionState = writable<ListeningConnectionState>("idle");

  let activeSlug: string | null = null;
  let eventSource: EventSource | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  let discoveryTimer: ReturnType<typeof setInterval> | undefined;
  let reconnectAttempt = 0;
  let shouldStayConnected = false;

  async function fetchSnapshot(slug: string) {
    const response = await fetch(`/api/rooms/${slug}/listening`);
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error(`Failed to load listening snapshot (${response.status})`);
    }
    return (await response.json()) as ListeningSnapshot;
  }

  function clearReconnectTimer() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = undefined;
    }
  }

  function stopDiscovery() {
    if (discoveryTimer) {
      clearInterval(discoveryTimer);
      discoveryTimer = undefined;
    }
  }

  function teardownEventSource() {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
  }

  function scheduleReconnect() {
    if (!shouldStayConnected || !activeSlug) return;
    clearReconnectTimer();
    const delay = BACKOFF_MS[Math.min(reconnectAttempt, BACKOFF_MS.length - 1)] ?? 15_000;
    reconnectTimer = setTimeout(() => {
      reconnectAttempt += 1;
      void openEventSource(activeSlug!);
    }, delay);
  }

  async function openEventSource(slug: string) {
    teardownEventSource();
    connectionState.set("connecting");

    try {
      const current = await fetchSnapshot(slug);
      if (!current?.session || current.session.endedAt) {
        snapshot.set(null);
        connectionState.set("idle");
        startDiscovery(slug);
        return;
      }

      snapshot.set(current);
      eventSource = new EventSource(`/api/rooms/${slug}/listening/events`);

      eventSource.addEventListener("snapshot", (event) => {
        const next = JSON.parse((event as MessageEvent<string>).data) as ListeningSnapshot;
        const active = Boolean(next.session && !next.session.endedAt);
        snapshot.set(active ? next : null);
        connectionState.set(active ? "connected" : "idle");
        reconnectAttempt = 0;

        if (!active) {
          teardownEventSource();
          startDiscovery(slug);
        }
      });

      eventSource.addEventListener("ping", () => {
        connectionState.set("connected");
      });

      eventSource.onerror = () => {
        connectionState.set("error");
        teardownEventSource();
        scheduleReconnect();
      };

      connectionState.set("connected");
      stopDiscovery();
    } catch {
      connectionState.set("error");
      scheduleReconnect();
    }
  }

  function startDiscovery(slug: string) {
    stopDiscovery();
    discoveryTimer = setInterval(() => {
      void fetchSnapshot(slug)
        .then((next) => {
          if (!next?.session || next.session.endedAt) return;
          snapshot.set(next);
          void openEventSource(slug);
        })
        .catch(() => {
          // Ignore transient discovery errors.
        });
    }, 5_000);
  }

  function connect(slug: string) {
    shouldStayConnected = true;
    activeSlug = slug;
    reconnectAttempt = 0;
    clearReconnectTimer();
    void openEventSource(slug);
  }

  function disconnect() {
    shouldStayConnected = false;
    activeSlug = null;
    reconnectAttempt = 0;
    clearReconnectTimer();
    stopDiscovery();
    teardownEventSource();
    snapshot.set(null);
    connectionState.set("idle");
  }

  async function refresh(slug: string) {
    const next = await fetchSnapshot(slug);
    snapshot.set(next?.session && !next.session.endedAt ? next : null);
    return next;
  }

  return {
    snapshot: { subscribe: snapshot.subscribe },
    connectionState: { subscribe: connectionState.subscribe },
    connect,
    disconnect,
    refresh,
  };
}
