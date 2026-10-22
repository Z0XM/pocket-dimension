import { isHttpUrl, youtubePlaylistHref } from "$lib/history-time";

export type ActivityLink = {
  label: string;
  href: string;
};

export function parseSyncSummary(raw: string | null | undefined) {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as {
      playlists?: string[] | { id: string; title: string }[];
      playlistTitles?: string[];
      items?: { title?: string; status?: string }[];
      tagIds?: string[];
    };
  } catch {
    return null;
  }
}

export function playlistLabel(
  sourceUrl: string,
  summary: ReturnType<typeof parseSyncSummary>
): {
  kind: "playlist_import" | "url_import";
  label: string;
  playlistTitles?: string[];
} {
  if (sourceUrl.startsWith("youtube:connected:")) {
    const titlesFromSummary =
      summary?.playlistTitles ??
      (Array.isArray(summary?.playlists) ? summary.playlists.map((p) => (typeof p === "string" ? p : p.title)).filter(Boolean) : []);
    const label =
      titlesFromSummary.length > 0
        ? titlesFromSummary.join(", ")
        : sourceUrl.slice("youtube:connected:".length).split(",").filter(Boolean).join(", ") || "YouTube playlists";
    return { kind: "playlist_import", label, playlistTitles: titlesFromSummary.length ? titlesFromSummary : undefined };
  }
  return { kind: "url_import", label: sourceUrl };
}

/** Clickable playlist / source links for an import sync run. */
export function importLinks(
  sourceUrl: string,
  summary: ReturnType<typeof parseSyncSummary>,
  meta: ReturnType<typeof playlistLabel>
): ActivityLink[] {
  if (meta.kind === "url_import") {
    return isHttpUrl(sourceUrl) ? [{ label: sourceUrl, href: sourceUrl }] : [];
  }

  const ids = sourceUrl.startsWith("youtube:connected:")
    ? sourceUrl
        .slice("youtube:connected:".length)
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean)
    : [];

  const titlesFromSummary =
    summary?.playlistTitles ??
    (Array.isArray(summary?.playlists) ? summary.playlists.map((p) => (typeof p === "string" ? p : p.title)).filter(Boolean) : []);

  if (ids.length === 0) return [];

  return ids.map((id, index) => ({
    label: titlesFromSummary[index] || id,
    href: youtubePlaylistHref(id),
  }));
}
