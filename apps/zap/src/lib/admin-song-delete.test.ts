import { describe, expect, test } from "bun:test";
import { describeSongDelete } from "./admin-song-delete";

describe("describeSongDelete", () => {
  test("reports storage outcome", () => {
    expect(describeSongDelete({ title: "A", storageKey: "media/a.m4a", storageDeleted: true, storageError: null })).toBe(
      'Deleted "A" and its storage object.'
    );
    expect(describeSongDelete({ title: "B", storageKey: null, storageDeleted: false, storageError: null })).toMatch(/no storage object/);
    expect(describeSongDelete({ title: "C", storageKey: "media/c.m4a", storageDeleted: false, storageError: "R2 down" })).toMatch(/R2 down/);
  });
});
