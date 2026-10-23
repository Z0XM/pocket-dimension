import { describe, expect, test } from "bun:test";
import { playlistRelationBadge } from "./playlist-relation-label";

/** Same constraint as createLinkedPlaylist: source owners must all be distinct. */
function ownersAreDistinct(ownerIds: string[]): boolean {
  return new Set(ownerIds).size === ownerIds.length;
}

describe("playlist follow + link constraints", () => {
  test("relation badges", () => {
    expect(playlistRelationBadge("owner", "linked")).toBe("Linked");
    expect(playlistRelationBadge("linked_member", "linked")).toBe("Linked");
    expect(playlistRelationBadge("follower", "standard")).toBe("Followed");
    expect(playlistRelationBadge("collaborator", "standard")).toBe("Collaborator");
    expect(playlistRelationBadge("owner", "standard")).toBeNull();
  });

  test("linked sources require different account owners", () => {
    expect(ownersAreDistinct(["a", "b"])).toBe(true);
    expect(ownersAreDistinct(["a", "a"])).toBe(false);
    expect(ownersAreDistinct(["a", "b", "a"])).toBe(false);
  });
});
