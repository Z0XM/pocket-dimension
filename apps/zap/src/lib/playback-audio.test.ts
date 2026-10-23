import { describe, expect, test } from "bun:test";
import { fakePlaybackEnergy } from "./playback-audio";

describe("fakePlaybackEnergy", () => {
  test("returns bounded channels", () => {
    for (const t of [0, 250, 1000, 3333]) {
      const e = fakePlaybackEnergy(t);
      expect(e.live).toBe(false);
      expect(e.bass).toBeGreaterThanOrEqual(0);
      expect(e.bass).toBeLessThanOrEqual(1);
      expect(e.mid).toBeGreaterThanOrEqual(0);
      expect(e.mid).toBeLessThanOrEqual(1);
      expect(e.beat).toBeGreaterThanOrEqual(0);
      expect(e.beat).toBeLessThanOrEqual(1);
    }
  });

  test("kick pulses over a bar", () => {
    const a = fakePlaybackEnergy(0);
    const b = fakePlaybackEnergy(250);
    // At least one sample should show stronger bass than the other across a beat cycle.
    expect(Math.abs(a.bass - b.bass) + Math.abs(a.beat - b.beat)).toBeGreaterThan(0.01);
  });
});
