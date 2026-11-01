import { describe, expect, test } from "bun:test";
import { createNdjsonSender } from "./ndjson-stream";

describe("createNdjsonSender", () => {
  test("ignores enqueue after close", () => {
    const chunks: Uint8Array[] = [];
    const controller = {
      enqueue(chunk: Uint8Array) {
        chunks.push(chunk);
      },
      close() {},
    } as unknown as ReadableStreamDefaultController<Uint8Array>;

    const sender = createNdjsonSender(controller);
    sender.send({ type: "progress", n: 1 });
    sender.close();
    sender.send({ type: "progress", n: 2 });
    sender.close();

    expect(chunks).toHaveLength(1);
    expect(sender.closed).toBe(true);
  });

  test("marks closed when enqueue throws", () => {
    const controller = {
      enqueue() {
        throw new TypeError("Invalid state: Controller is already closed");
      },
      close() {},
    } as unknown as ReadableStreamDefaultController<Uint8Array>;

    const sender = createNdjsonSender(controller);
    sender.send({ type: "progress" });
    expect(sender.closed).toBe(true);
    sender.send({ type: "done" });
  });
});
