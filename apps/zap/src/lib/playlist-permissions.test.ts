import { describe, expect, test } from "bun:test";
import { playlistDeleteAccess } from "./playlist-permissions";

const owner = "owner-1";
const other = "user-2";

describe("playlistDeleteAccess", () => {
  test("owner can delete private and public playlists", () => {
    expect(playlistDeleteAccess({ ownerUserId: owner, visibility: "private" }, owner, true)).toBe("allowed");
    expect(playlistDeleteAccess({ ownerUserId: owner, visibility: "public" }, owner, false)).toBe("allowed");
  });

  test("collaborators can edit but not delete", () => {
    expect(playlistDeleteAccess({ ownerUserId: owner, visibility: "private" }, other, true)).toBe("forbidden");
  });

  test("viewers of a public playlist are forbidden", () => {
    expect(playlistDeleteAccess({ ownerUserId: owner, visibility: "public" }, other, false)).toBe("forbidden");
  });

  test("someone else's private playlist reads as missing", () => {
    expect(playlistDeleteAccess({ ownerUserId: owner, visibility: "private" }, other, false)).toBe("not_found");
  });

  test("deleted playlist is missing", () => {
    expect(playlistDeleteAccess(null, owner, false)).toBe("not_found");
    expect(playlistDeleteAccess(undefined, owner, false)).toBe("not_found");
  });
});
