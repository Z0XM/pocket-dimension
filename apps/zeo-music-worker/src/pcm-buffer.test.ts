import { describe, expect, it } from "bun:test";
import { appendPending, clearPending, createPendingPcm, releaseWarmFrames, takeFrame } from "./pcm-buffer";
import { createLruStringCache } from "./url-cache";

describe("pending PCM buffer", () => {
  it("extracts fixed-size frames without retaining consumed bytes", () => {
    const pending = createPendingPcm();
    const frameSize = 4;
    appendPending(pending, new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9]));

    const first = takeFrame(pending, frameSize);
    const second = takeFrame(pending, frameSize);
    expect(first).toEqual(new Uint8Array([1, 2, 3, 4]));
    expect(second).toEqual(new Uint8Array([5, 6, 7, 8]));
    expect(takeFrame(pending, frameSize)).toBeNull();

    appendPending(pending, new Uint8Array([10, 11, 12]));
    // Compaction on append should drop the already-read prefix.
    expect(pending.offset).toBe(0);
    expect(pending.bytes.byteLength).toBe(4);
    expect(takeFrame(pending, frameSize)).toEqual(new Uint8Array([9, 10, 11, 12]));
    expect(pending.bytes.byteLength - pending.offset).toBe(0);
  });

  it("clearPending drops all retained bytes", () => {
    const pending = createPendingPcm();
    appendPending(pending, new Uint8Array(64));
    clearPending(pending);
    expect(pending.bytes.byteLength).toBe(0);
    expect(pending.offset).toBe(0);
  });

  it("releaseWarmFrames empties the frame list", () => {
    const frames = [new Uint8Array(8), new Uint8Array(8)];
    releaseWarmFrames(frames);
    expect(frames.length).toBe(0);
  });
});

describe("audio URL LRU cache", () => {
  it("evicts oldest entries past the max size", () => {
    const cache = createLruStringCache(2);
    cache.set("a", "url-a");
    cache.set("b", "url-b");
    cache.set("c", "url-c");
    expect(cache.size).toBe(2);
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBe("url-b");
    expect(cache.get("c")).toBe("url-c");
  });

  it("refreshes recency on get", () => {
    const cache = createLruStringCache(2);
    cache.set("a", "url-a");
    cache.set("b", "url-b");
    expect(cache.get("a")).toBe("url-a");
    cache.set("c", "url-c");
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("a")).toBe("url-a");
    expect(cache.get("c")).toBe("url-c");
  });
});
