import { describe, expect, test } from "bun:test";
import { parsePlaylistImportSort, sortPlaylistItemsForImport } from "./youtube-playlist-sort";

const sample = [
  {
    videoId: "c",
    title: "Charlie",
    position: 2,
    addedAt: "2024-01-03T00:00:00Z",
    videoPublishedAt: "2020-01-01T00:00:00Z",
  },
  {
    videoId: "a",
    title: "Alpha",
    position: 0,
    addedAt: "2024-01-01T00:00:00Z",
    videoPublishedAt: "2022-01-01T00:00:00Z",
  },
  {
    videoId: "b",
    title: "Bravo",
    position: 1,
    addedAt: "2024-01-02T00:00:00Z",
    videoPublishedAt: "2021-01-01T00:00:00Z",
  },
];

describe("playlist import sort", () => {
  test("defaults unknown sort to playlist", () => {
    expect(parsePlaylistImportSort("nope")).toBe("playlist");
    expect(parsePlaylistImportSort("date_added_desc")).toBe("date_added_desc");
  });

  test("playlist order uses position", () => {
    expect(sortPlaylistItemsForImport(sample, "playlist").map((i) => i.videoId)).toEqual(["a", "b", "c"]);
  });

  test("latest added", () => {
    expect(sortPlaylistItemsForImport(sample, "date_added_desc").map((i) => i.videoId)).toEqual(["c", "b", "a"]);
  });

  test("newest video publish", () => {
    expect(sortPlaylistItemsForImport(sample, "video_published_desc").map((i) => i.videoId)).toEqual(["a", "b", "c"]);
  });

  test("title A-Z", () => {
    expect(sortPlaylistItemsForImport(sample, "title_asc").map((i) => i.videoId)).toEqual(["a", "b", "c"]);
  });
});
