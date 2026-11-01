import { describe, expect, test } from "bun:test";
import { PLAYHEAD_HARD_SNAP_MS, reconcilePlayhead, serverPlayheadMs } from "./session-playhead";

describe("serverPlayheadMs", () => {
  test("extrapolates while playing from positionUpdatedAt", () => {
    const at = Date.now() - 5000;
    const ms = serverPlayheadMs(
      { playbackState: "playing", positionMs: 10_000, positionUpdatedAt: new Date(at).toISOString() },
      at + 5000,
      60_000
    );
    expect(ms).toBe(15_000);
  });

  test("does not advance while paused", () => {
    const at = Date.now() - 5000;
    const ms = serverPlayheadMs(
      { playbackState: "paused", positionMs: 10_000, positionUpdatedAt: new Date(at).toISOString() },
      at + 5000,
      60_000
    );
    expect(ms).toBe(10_000);
  });
});

describe("reconcilePlayhead", () => {
  test("hard snaps on force or large drift", () => {
    expect(reconcilePlayhead(1000, 5000, true)).toBe(5000);
    expect(reconcilePlayhead(1000, 1000 + PLAYHEAD_HARD_SNAP_MS, false)).toBe(1000 + PLAYHEAD_HARD_SNAP_MS);
  });

  test("soft-corrects small drift without full snap", () => {
    const next = reconcilePlayhead(10_000, 10_400, false);
    expect(next).toBeGreaterThan(10_000);
    expect(next).toBeLessThan(10_400);
  });
});
