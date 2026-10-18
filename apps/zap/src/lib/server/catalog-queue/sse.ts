import { catalogQueueBus } from "./event-bus";
import { buildCatalogQueueSnapshot, pauseIfPlaying, publishCatalogQueue, registerDevice, touchDevice } from "./queue";

const PING_INTERVAL_MS = 25_000;
/** A reload / flaky network reconnects well inside this window; after it, a queue nobody hears is paused. */
const LAST_DEVICE_GRACE_MS = 20_000;

const pauseTimers = new Map<string, ReturnType<typeof setTimeout>>();

function encodeSSE(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/**
 * One stream per open Zap tab/device. Sync is SSE (server → client snapshots) + plain POSTs for commands,
 * matching the session stream: no extra adapter/proxy setup, and EventSource reconnects on its own.
 */
export async function createCatalogQueueStream(userId: string, deviceId: string, label: string, signal?: AbortSignal) {
  const onlineBefore = catalogQueueBus.connect(userId, deviceId);
  const pendingPause = pauseTimers.get(userId);
  if (pendingPause) {
    clearTimeout(pendingPause);
    pauseTimers.delete(userId);
  }

  try {
    await registerDevice(userId, deviceId, label);
    // First device after a cold start (e.g. server restart) — a "playing" state nobody could hear is stale.
    if (onlineBefore === 0 && !pendingPause) await pauseIfPlaying(userId);
  } catch (err) {
    catalogQueueBus.disconnect(userId, deviceId);
    throw err;
  }

  const encoder = new TextEncoder();
  let pingTimer: ReturnType<typeof setInterval> | undefined;
  let unsubscribe: (() => void) | undefined;
  let closed = false;

  function close() {
    if (closed) return;
    closed = true;
    if (pingTimer) clearInterval(pingTimer);
    unsubscribe?.();
    const remaining = catalogQueueBus.disconnect(userId, deviceId);
    void touchDevice(userId, deviceId).catch(() => {});
    if (remaining === 0) {
      const timer = setTimeout(() => {
        pauseTimers.delete(userId);
        if (catalogQueueBus.onlineDeviceIds(userId).size > 0) return;
        void pauseIfPlaying(userId).catch((err) => console.warn("[zap catalog queue] auto-pause failed", err));
      }, LAST_DEVICE_GRACE_MS);
      pauseTimers.set(userId, timer);
    }
    void publishCatalogQueue(userId).catch(() => {});
  }

  // Presence must drop as soon as the client goes away; not every server runtime calls `cancel()` for that.
  signal?.addEventListener("abort", close, { once: true });

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(encodeSSE(event, data)));
        } catch {
          close();
        }
      };
      if (closed) return;
      unsubscribe = catalogQueueBus.subscribe(userId, (snapshot) => send("snapshot", snapshot));
      send("snapshot", await buildCatalogQueueSnapshot(userId));
      if (closed) return;
      // Tell the user's other devices this one came online.
      void publishCatalogQueue(userId).catch(() => {});
      pingTimer = setInterval(() => send("ping", {}), PING_INTERVAL_MS);
    },
    cancel() {
      close();
    },
  });
}
