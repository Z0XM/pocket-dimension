import { gameEventBus } from "./event-bus";
import type { GameSnapshot } from "./types";

const PING_INTERVAL_MS = 30_000;

function encodeSSE(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export function createGameSSEStream(sessionId: string, initialSnapshot: GameSnapshot) {
  const encoder = new TextEncoder();
  let pingTimer: ReturnType<typeof setInterval> | undefined;
  let unsubscribe: (() => void) | undefined;
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(encoder.encode(encodeSSE(event, data)));
      };

      send("snapshot", initialSnapshot);

      unsubscribe = gameEventBus.subscribe(sessionId, (snapshot) => {
        send("snapshot", snapshot);
        if (snapshot.session?.status === "ended") {
          closeStream();
        }
      });

      pingTimer = setInterval(() => {
        send("ping", {});
      }, PING_INTERVAL_MS);
    },
    cancel() {
      closeStream();
    },
  });

  function closeStream() {
    if (closed) return;
    closed = true;
    if (pingTimer) clearInterval(pingTimer);
    unsubscribe?.();
  }

  return stream;
}
