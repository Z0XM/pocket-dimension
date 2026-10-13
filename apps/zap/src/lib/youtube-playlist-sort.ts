/** Sort modes supported for connected YouTube playlist import (client-side; API has no order param). */
export type PlaylistImportSort =
  "playlist" | "date_added_desc" | "date_added_asc" | "video_published_desc" | "video_published_asc" | "title_asc" | "title_desc";

export const PLAYLIST_IMPORT_SORT_OPTIONS: { value: PlaylistImportSort; label: string }[] = [
  { value: "playlist", label: "Playlist order" },
  { value: "date_added_desc", label: "Latest added to playlist" },
  { value: "date_added_asc", label: "Oldest added to playlist" },
  { value: "video_published_desc", label: "Newest video publish date" },
  { value: "video_published_asc", label: "Oldest video publish date" },
  { value: "title_asc", label: "Title A–Z" },
  { value: "title_desc", label: "Title Z–A" },
];

export function parsePlaylistImportSort(raw: unknown): PlaylistImportSort {
  const v = typeof raw === "string" ? raw.trim() : "";
  if (PLAYLIST_IMPORT_SORT_OPTIONS.some((o) => o.value === v)) return v as PlaylistImportSort;
  return "playlist";
}

export type SortablePlaylistItem = {
  videoId: string;
  title: string;
  position: number | null;
  addedAt: string | null;
  videoPublishedAt: string | null;
};

function timeMs(iso: string | null | undefined): number {
  if (!iso) return 0;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}

/**
 * Sort playlist entries for import. Stable for equal keys via videoId.
 * Assign `position` from API when present; for `playlist` mode, position wins.
 */
export function sortPlaylistItemsForImport<T extends SortablePlaylistItem>(items: T[], sort: PlaylistImportSort): T[] {
  const copy = [...items];
  const byId = (a: T, b: T) => a.videoId.localeCompare(b.videoId);

  copy.sort((a, b) => {
    let cmp = 0;
    switch (sort) {
      case "playlist":
        cmp = (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER);
        break;
      case "date_added_desc":
        cmp = timeMs(b.addedAt) - timeMs(a.addedAt);
        break;
      case "date_added_asc":
        cmp = timeMs(a.addedAt) - timeMs(b.addedAt);
        break;
      case "video_published_desc":
        cmp = timeMs(b.videoPublishedAt) - timeMs(a.videoPublishedAt);
        break;
      case "video_published_asc":
        cmp = timeMs(a.videoPublishedAt) - timeMs(b.videoPublishedAt);
        break;
      case "title_asc":
        cmp = a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
        break;
      case "title_desc":
        cmp = b.title.localeCompare(a.title, undefined, { sensitivity: "base" });
        break;
    }
    return cmp !== 0 ? cmp : byId(a, b);
  });

  return copy;
}
