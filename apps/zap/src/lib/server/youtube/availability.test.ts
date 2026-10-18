import { describe, expect, test } from "bun:test";
import { youtubeItemUnavailableReason } from "./availability";

describe("youtubeItemUnavailableReason", () => {
  test("placeholder titles from playlistItems.list", () => {
    expect(youtubeItemUnavailableReason({ title: "Private video", video: null })).toBe("Private video");
    expect(youtubeItemUnavailableReason({ title: "Deleted video", video: null })).toBe("Video removed");
  });

  test("real title but missing from videos.list", () => {
    expect(youtubeItemUnavailableReason({ title: "Some Song", video: null })).toBe("Video unavailable");
  });

  test("uploadStatus removed / rejected / failed", () => {
    expect(youtubeItemUnavailableReason({ title: "Song", video: { uploadStatus: "deleted" } })).toBe("Video removed");
    expect(youtubeItemUnavailableReason({ title: "Song", video: { uploadStatus: "rejected" } })).toBe("Video removed");
    expect(youtubeItemUnavailableReason({ title: "Song", video: { uploadStatus: "failed" } })).toBe("Video unavailable");
  });

  test("normal processed video is available", () => {
    expect(youtubeItemUnavailableReason({ title: "Song", video: { uploadStatus: "processed", privacyStatus: "public" } })).toBeNull();
    expect(youtubeItemUnavailableReason({ title: "Song", video: { uploadStatus: "processed", privacyStatus: "private" } })).toBeNull();
  });
});
