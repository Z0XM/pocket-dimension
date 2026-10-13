import { describe, expect, test } from "bun:test";
import { playbackCommandFromSnapshot, shouldResync } from "./sync";
import type { SessionSnapshot } from "$lib/server/sessions/types";

function baseSnapshot(overrides: Partial<SessionSnapshot["session"]> & { playable?: boolean } = {}): SessionSnapshot {
  const { playable = true, ...sessionOverrides } = overrides;
  return {
    version: 1,
    serverNow: new Date().toISOString(),
    session: {
      id: "s1",
      hostUserId: "u1",
      joinCode: "ABC123",
      status: "live",
      playbackState: "idle",
      currentQueueItemId: "q1",
      positionMs: 0,
      positionUpdatedAt: new Date().toISOString(),
      playbackGeneration: 1,
      guestsCanAdd: false,
      guestsCanControl: false,
      autoPlay: true,
      lastActivityAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      endedAt: null,
      ...sessionOverrides,
    },
    currentItem: {
      id: "q1",
      sessionId: "s1",
      position: 0,
      mediaAssetId: "m1",
      title: "Track",
      artists: null,
      durationMs: 60000,
      playable,
      addedByUserId: "u1",
      addedByDisplayName: "Host",
      createdAt: new Date().toISOString(),
    },
    queue: [],
    members: [],
    me: null,
  };
}

describe("discord playback sync", () => {
  test("idle when no playable current item", () => {
    expect(playbackCommandFromSnapshot(baseSnapshot({ playable: false })).action).toBe("idle");
  });

  test("playing maps to play command", () => {
    const cmd = playbackCommandFromSnapshot(baseSnapshot({ playbackState: "playing", positionMs: 1000, playbackGeneration: 3 }));
    expect(cmd.action).toBe("play");
    if (cmd.action === "play") {
      expect(cmd.mediaAssetId).toBe("m1");
      expect(cmd.generation).toBe(3);
      expect(cmd.positionMs).toBeGreaterThanOrEqual(1000);
    }
  });

  test("paused maps to pause", () => {
    const cmd = playbackCommandFromSnapshot(baseSnapshot({ playbackState: "paused", positionMs: 2500, playbackGeneration: 4 }));
    expect(cmd).toEqual({ action: "pause", positionMs: 2500, generation: 4 });
  });

  test("ended session → idle", () => {
    expect(playbackCommandFromSnapshot(baseSnapshot({ status: "ended", endedAt: new Date().toISOString() })).action).toBe("idle");
  });

  test("shouldResync on generation or asset change", () => {
    expect(shouldResync(1, 1, "a", "a")).toBe(false);
    expect(shouldResync(1, 2, "a", "a")).toBe(true);
    expect(shouldResync(1, 1, "a", "b")).toBe(true);
  });
});
