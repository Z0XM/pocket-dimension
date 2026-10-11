import { describe, expect, test } from "bun:test";
import { parseBytesRange } from "./byte-range";

describe("parseBytesRange", () => {
  test("no header → full", () => {
    expect(parseBytesRange(null, 1000)).toEqual({ type: "full" });
  });

  test("bytes=0- (HTML5 audio first request) → full span", () => {
    expect(parseBytesRange("bytes=0-", 1000)).toEqual({ type: "partial", start: 0, end: 999 });
  });

  test("bytes=0-499 → partial", () => {
    expect(parseBytesRange("bytes=0-499", 1000)).toEqual({ type: "partial", start: 0, end: 499 });
  });

  test("open end past EOF is clamped", () => {
    expect(parseBytesRange("bytes=100-9999", 1000)).toEqual({ type: "partial", start: 100, end: 999 });
  });

  test("suffix bytes=-100", () => {
    expect(parseBytesRange("bytes=-100", 1000)).toEqual({ type: "partial", start: 900, end: 999 });
  });

  test("start past EOF → unsatisfiable", () => {
    expect(parseBytesRange("bytes=1000-", 1000)).toEqual({ type: "unsatisfiable" });
  });

  test("size 0 → full (avoid 416 on unknown/empty)", () => {
    expect(parseBytesRange("bytes=0-", 0)).toEqual({ type: "full" });
  });

  test("malformed → full", () => {
    expect(parseBytesRange("eggs=1-2", 1000)).toEqual({ type: "full" });
  });
});
