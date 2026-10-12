import { describe, expect, test } from "bun:test";
import { mapPool } from "./map-pool";

describe("mapPool", () => {
  test("preserves order with limited concurrency", async () => {
    const started: number[] = [];
    const results = await mapPool([3, 1, 2], 2, async (n, i) => {
      started.push(i);
      await Bun.sleep(n * 15);
      return n * 10;
    });
    expect(results).toEqual([30, 10, 20]);
    expect(started[0]).toBe(0);
    expect(started[1]).toBe(1);
  });

  test("empty input", async () => {
    expect(await mapPool([], 4, async (x) => x)).toEqual([]);
  });
});
