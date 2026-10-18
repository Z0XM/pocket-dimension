import { describe, expect, test } from "bun:test";
import { parsePlaylistTrackSort, sortPlaylistTracks, type SortablePlaylistTrack } from "./playlist-sort";

const tracks: SortablePlaylistTrack[] = [
  { id: "1", title: "Zebra", artists: "Beta", addedAt: "2024-01-03T00:00:00.000Z" },
  { id: "2", title: "Apple", artists: null, addedAt: "2024-01-01T00:00:00.000Z" },
  { id: "3", title: "Mango", artists: "Alpha", addedAt: "2024-01-02T00:00:00.000Z" },
  { id: "4", title: "Banana", artists: "  ", addedAt: "2024-01-04T00:00:00.000Z" },
];

describe("parsePlaylistTrackSort", () => {
  test("accepts known keys", () => {
    expect(parsePlaylistTrackSort("title_asc")).toBe("title_asc");
    expect(parsePlaylistTrackSort("artist_asc")).toBe("artist_asc");
    expect(parsePlaylistTrackSort("added_desc")).toBe("added_desc");
  });
  test("rejects unknown", () => {
    expect(parsePlaylistTrackSort("nope")).toBeNull();
    expect(parsePlaylistTrackSort(null)).toBeNull();
  });
});

describe("sortPlaylistTracks", () => {
  test("title A–Z / Z–A", () => {
    expect(sortPlaylistTracks(tracks, "title_asc").map((t) => t.title)).toEqual(["Apple", "Banana", "Mango", "Zebra"]);
    expect(sortPlaylistTracks(tracks, "title_desc").map((t) => t.title)).toEqual(["Zebra", "Mango", "Banana", "Apple"]);
  });

  test("artist A–Z with missing artists last, then title", () => {
    expect(sortPlaylistTracks(tracks, "artist_asc").map((t) => t.id)).toEqual(["3", "1", "2", "4"]);
  });

  test("date added asc / desc", () => {
    expect(sortPlaylistTracks(tracks, "added_asc").map((t) => t.id)).toEqual(["2", "3", "1", "4"]);
    expect(sortPlaylistTracks(tracks, "added_desc").map((t) => t.id)).toEqual(["4", "1", "3", "2"]);
  });

  test("does not mutate input", () => {
    const before = tracks.map((t) => t.id);
    sortPlaylistTracks(tracks, "title_asc");
    expect(tracks.map((t) => t.id)).toEqual(before);
  });
});
