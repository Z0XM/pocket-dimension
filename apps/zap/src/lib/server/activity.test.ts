import { describe, expect, test } from "bun:test";

/** Mirror of playlistLabel parsing used in activity.ts for unit coverage. */
function playlistLabel(
  sourceUrl: string,
  summary: {
    playlists?: string[] | { id: string; title: string }[];
    playlistTitles?: string[];
  } | null
) {
  if (sourceUrl.startsWith("youtube:connected:")) {
    const titlesFromSummary =
      summary?.playlistTitles ??
      (Array.isArray(summary?.playlists) ? summary.playlists.map((p) => (typeof p === "string" ? p : p.title)).filter(Boolean) : []);
    const label =
      titlesFromSummary.length > 0
        ? titlesFromSummary.join(", ")
        : sourceUrl.slice("youtube:connected:".length).split(",").filter(Boolean).join(", ") || "YouTube playlists";
    return { kind: "playlist_import" as const, label, playlistTitles: titlesFromSummary.length ? titlesFromSummary : undefined };
  }
  return { kind: "url_import" as const, label: sourceUrl };
}

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

  test("treats other urls as url imports", () => {
    const out = playlistLabel("https://youtu.be/xyz", null);
    expect(out.kind).toBe("url_import");
    expect(out.label).toBe("https://youtu.be/xyz");
  });
});
