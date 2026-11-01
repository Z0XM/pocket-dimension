/** Safe NDJSON writer for long-lived ingest streams (client cancel / late progress must not throw). */
export function createNdjsonSender(controller: ReadableStreamDefaultController<Uint8Array>) {
  const encoder = new TextEncoder();
  let closed = false;

  return {
    get closed() {
      return closed;
    },
    send(payload: Record<string, unknown>) {
      if (closed) return;
      try {
        controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
      } catch {
        closed = true;
      }
    },
    close() {
      if (closed) return;
      closed = true;
      try {
        controller.close();
      } catch {
        // already closed by cancel
      }
    },
  };
}
