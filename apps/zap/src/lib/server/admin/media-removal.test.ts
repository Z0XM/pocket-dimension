import { describe, expect, test } from "bun:test";
import { nextPlaybackAfterRemoval, planPositionCompaction } from "./media-removal";

/** Applies updates one by one, failing like a (parent, position) unique index would. */
function applyWithUniqueCheck(rows: { id: string; position: number }[], updates: { id: string; position: number }[]) {
  const byId = new Map(rows.map((r) => [r.id, { ...r }]));
  for (const u of updates) {
    const clash = [...byId.values()].find((r) => r.position === u.position && r.id !== u.id);
    if (clash) throw new Error(`position ${u.position} taken by ${clash.id}`);
    byId.get(u.id)!.position = u.position;
  }
  return [...byId.values()].sort((a, b) => a.position - b.position);
}

describe("planPositionCompaction", () => {
  test("closes gaps left by removed rows without unique clashes", () => {
    const rows = [
      { id: "d", position: 5 },
      { id: "a", position: 0 },
      { id: "c", position: 3 },
      { id: "b", position: 2 },
    ];
    const updates = planPositionCompaction(rows);
    const result = applyWithUniqueCheck(rows, updates);
    expect(result.map((r) => [r.id, r.position])).toEqual([
      ["a", 0],
      ["b", 1],
      ["c", 2],
      ["d", 3],
    ]);
  });

  test("no updates when already contiguous", () => {
    expect(
      planPositionCompaction([
        { id: "a", position: 0 },
        { id: "b", position: 1 },
      ])
    ).toEqual([]);
  });
});

describe("nextPlaybackAfterRemoval", () => {
  const remaining = [
    { id: "q0", position: 0 },
    { id: "q2", position: 2 },
    { id: "q4", position: 4 },
  ];

  test("moves to the next item after the removed current one, keeping transport", () => {
    expect(nextPlaybackAfterRemoval({ removedCurrentPosition: 1, playbackState: "playing", remaining })).toEqual({
      currentQueueItemId: "q2",
      playbackState: "playing",
      positionMs: 0,
    });
  });

  test("idle becomes paused on the next item", () => {
    expect(nextPlaybackAfterRemoval({ removedCurrentPosition: 3, playbackState: "idle", remaining }).playbackState).toBe("paused");
  });

  test("goes idle when nothing follows", () => {
    expect(nextPlaybackAfterRemoval({ removedCurrentPosition: 5, playbackState: "playing", remaining })).toEqual({
      currentQueueItemId: null,
      playbackState: "idle",
      positionMs: 0,
    });
  });
});
