import { describe, expect, test } from "bun:test";
import { extractYoutubePlaylistId, extractYoutubeVideoId, parseMediaUrl } from "./url-parse";

describe("parseMediaUrl", () => {
  test("watch URL → youtube_video", () => {
    const p = parseMediaUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(p?.kind).toBe("youtube_video");
    if (p?.kind === "youtube_video") {
      expect(p.videoId).toBe("dQw4w9WgXcQ");
      expect(p.identityKey).toBe("youtube:dQw4w9WgXcQ");
    }
  });

  test("youtu.be short link", () => {
    expect(extractYoutubeVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  test("playlist URL without v= → playlist", () => {
    const p = parseMediaUrl("https://www.youtube.com/playlist?list=PLtest1234567890");
    expect(p?.kind).toBe("youtube_playlist");
    expect(extractYoutubePlaylistId("https://www.youtube.com/playlist?list=PLtest1234567890")).toBe("PLtest1234567890");
  });

  test("watch URL with list still treated as video", () => {
    const p = parseMediaUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLabc");
    expect(p?.kind).toBe("youtube_video");
  });

  test("generic https URL", () => {
    const p = parseMediaUrl("https://example.com/song.mp3");
    expect(p?.kind).toBe("generic");
    if (p?.kind === "generic") {
      expect(p.identityKey.startsWith("url:")).toBe(true);
    }
  });

  test("rejects non-http", () => {
    expect(parseMediaUrl("ftp://x")).toBeNull();
    expect(parseMediaUrl("not a url")).toBeNull();
  });
});
