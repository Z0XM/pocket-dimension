import { describe, expect, test } from "bun:test";
import { importLinks, playlistLabel } from "$lib/activity-links";

describe("playlist activity labels", () => {
  test("uses playlist titles from summary", () => {
    const out = playlistLabel("youtube:connected:abc,def", {
      playlistTitles: ["Liked videos", "Chill"],
    });
    expect(out.kind).toBe("playlist_import");
    expect(out.label).toBe("Liked videos, Chill");
  });

  test("falls back to playlist ids", () => {
    const out = playlistLabel("youtube:connected:abc,def", null);
    expect(out.label).toBe("abc, def");
  });

  test("uses song title from summary for url imports", () => {
    const out = playlistLabel("https://youtu.be/xyz", {
      items: [{ title: "Midnight City", status: "imported" }],
    });
    expect(out.kind).toBe("url_import");
    expect(out.label).toBe("Midnight City");
  });

  test("falls back to raw url when no title metadata", () => {
    const out = playlistLabel("https://youtu.be/xyz", null);
    expect(out.kind).toBe("url_import");
    expect(out.label).toBe("https://youtu.be/xyz");
  });
});

describe("import links", () => {
  test("makes connected playlists clickable with titles", () => {
    const sourceUrl = "youtube:connected:PLabc,PLdef";
    const summary = { playlistTitles: ["Liked videos", "Chill"] };
    const meta = playlistLabel(sourceUrl, summary);
    expect(importLinks(sourceUrl, summary, meta)).toEqual([
      { label: "Liked videos", href: "https://www.youtube.com/playlist?list=PLabc" },
      { label: "Chill", href: "https://www.youtube.com/playlist?list=PLdef" },
    ]);
  });

  test("url imports link song titles to the origin URL", () => {
    const sourceUrl = "https://youtu.be/xyz";
    const summary = { items: [{ title: "Midnight City", status: "imported" }] };
    const meta = playlistLabel(sourceUrl, summary);
    expect(importLinks(sourceUrl, summary, meta)).toEqual([{ label: "Midnight City", href: sourceUrl }]);
  });

  test("url imports fall back to raw url label without metadata", () => {
    const sourceUrl = "https://youtu.be/xyz";
    const meta = playlistLabel(sourceUrl, null);
    expect(importLinks(sourceUrl, null, meta)).toEqual([{ label: sourceUrl, href: sourceUrl }]);
  });
});
