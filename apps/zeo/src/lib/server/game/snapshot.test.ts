import { describe, expect, it } from "bun:test";
import { buildGameSnapshotFromRows, emptyGameSnapshot } from "./snapshot";

describe("buildGameSnapshotFromRows", () => {
  it("returns the empty session snapshot shape when no round is active", () => {
    const empty = emptyGameSnapshot();
    expect(empty).toEqual({
      version: 0,
      session: null,
      teams: [],
      participants: [],
      round: null,
      roomScores: [],
    });

    const createdAt = new Date("2026-07-12T12:00:00.000Z");
    const snapshot = buildGameSnapshotFromRows({
      session: {
        id: "session-1",
        roomId: "room-1",
        hostUserId: "host-1",
        gameType: "charades",
        status: "active",
        teamCount: 2,
        config: { snapshotVersion: 3 },
        createdAt,
        endedAt: null,
      },
      teams: [
        {
          id: "team-a",
          sessionId: "session-1",
          name: "Team A",
          colorKey: "#16a34a",
          sortOrder: 0,
          score: 0,
        },
      ],
      participants: [
        {
          sessionId: "session-1",
          userId: "user-1",
          teamId: "team-a",
          isReady: false,
        },
      ],
      round: null,
      roomScores: [],
      userNames: new Map([["user-1", "Alice"]]),
    });

    expect(snapshot.version).toBe(3);
    expect(snapshot.session?.status).toBe("active");
    expect(snapshot.round).toBeNull();
    expect(snapshot.teams).toHaveLength(1);
    expect(snapshot.teams[0]?.memberUserIds).toEqual(["user-1"]);
    expect(snapshot.participants[0]?.displayName).toBe("Alice");
  });
});
