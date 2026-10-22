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

/** Song titles from an ingest summary, preferring imported/reused then any titled item. */
export function songTitlesFromSummary(summary: ReturnType<typeof parseSyncSummary>): string[] {
  const items = summary?.items ?? [];
  const preferred = items
    .filter((i) => i.status === "imported" || i.status === "reused")
    .map((i) => i.title?.trim())
    .filter((t): t is string => Boolean(t));
  const pool = preferred.length
    ? preferred
    : items.map((i) => i.title?.trim()).filter((t): t is string => Boolean(t));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const title of pool) {
    if (seen.has(title)) continue;
    seen.add(title);
    out.push(title);
  }
  return out;
}

function formatTitleList(titles: string[], max = 3): string {
  if (titles.length === 0) return "";
  if (titles.length <= max) return titles.join(", ");
  return `${titles.slice(0, max).join(", ")} +${titles.length - max}`;
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
  // URL / single-video import: show song title(s) from metadata, not the raw URL.
  const songTitles = songTitlesFromSummary(summary);
  const label = formatTitleList(songTitles) || sourceUrl;
  return { kind: "url_import", label };
}

/** Clickable playlist / source links for an import sync run. */
export function importLinks(
  sourceUrl: string,
  summary: ReturnType<typeof parseSyncSummary>,
  meta: ReturnType<typeof playlistLabel>
): ActivityLink[] {
  if (meta.kind === "url_import") {
    // Song title (or titles) as link text; href is always the origin/source URL.
    return isHttpUrl(sourceUrl) ? [{ label: meta.label, href: sourceUrl }] : [];
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
