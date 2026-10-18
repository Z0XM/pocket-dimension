/** Persistable sort modes for playlist tracks (rewrites `position`). */
export type PlaylistTrackSort = "title_asc" | "title_desc" | "artist_asc" | "added_asc" | "added_desc";

export const PLAYLIST_TRACK_SORT_OPTIONS: { value: PlaylistTrackSort; label: string }[] = [
  { value: "title_asc", label: "Title A–Z" },
  { value: "title_desc", label: "Title Z–A" },
  { value: "artist_asc", label: "Artist A–Z" },
  { value: "added_asc", label: "Oldest added" },
  { value: "added_desc", label: "Newest added" },
];

export function parsePlaylistTrackSort(raw: unknown): PlaylistTrackSort | null {
  const v = typeof raw === "string" ? raw.trim() : "";
  return PLAYLIST_TRACK_SORT_OPTIONS.some((o) => o.value === v) ? (v as PlaylistTrackSort) : null;
}

export type SortablePlaylistTrack = {
  id: string;
  title: string;
  artists: string | null;
  /** ISO timestamp when the track was added to the playlist. */
  addedAt: string;
};

function timeMs(iso: string): number {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}

/** Locale-aware title/artist compare; empty/missing artist sorts after named artists, then by title. */
function cmpText(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: "base", numeric: true });
}

/**
 * Sort playlist item rows for a user-chosen sort. Stable via item id when keys tie.
 * Artist sort falls back to title when artists is null/blank.
 */
export function sortPlaylistTracks<T extends SortablePlaylistTrack>(items: T[], sort: PlaylistTrackSort): T[] {
  const copy = [...items];
  const byId = (a: T, b: T) => a.id.localeCompare(b.id);

  copy.sort((a, b) => {
    let cmp = 0;
    switch (sort) {
      case "title_asc":
        cmp = cmpText(a.title, b.title);
        break;
      case "title_desc":
        cmp = cmpText(b.title, a.title);
        break;
      case "artist_asc": {
        const aa = a.artists?.trim() || "";
        const bb = b.artists?.trim() || "";
        if (!aa && !bb) cmp = cmpText(a.title, b.title);
        else if (!aa) cmp = 1;
        else if (!bb) cmp = -1;
        else {
          cmp = cmpText(aa, bb);
          if (cmp === 0) cmp = cmpText(a.title, b.title);
        }
        break;
      }
      case "added_asc":
        cmp = timeMs(a.addedAt) - timeMs(b.addedAt);
        break;
      case "added_desc":
        cmp = timeMs(b.addedAt) - timeMs(a.addedAt);
        break;
    }
    return cmp !== 0 ? cmp : byId(a, b);
  });

  return copy;
}
