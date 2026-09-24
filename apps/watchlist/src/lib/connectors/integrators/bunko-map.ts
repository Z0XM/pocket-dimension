/**
 * Map Bunko public Movies API rows → watchlist catalog + rating import rows.
 * Pure helpers — unit tested; no DB / network.
 */

export type BunkoMovieRow = {
  id?: number | string;
  name?: unknown;
  type?: unknown;
  status?: unknown;
  rating?: unknown;
  poster?: unknown;
  created_on?: unknown;
  edited_on?: unknown;
  [key: string]: unknown;
};

export type MapSkip = { skip: true; reason: string; raw?: BunkoMovieRow };
export type MapOk<T> = { skip: false; value: T };
export type MapResult<T> = MapOk<T> | MapSkip;

export type CatalogImportRow = {
  title: string;
  type: "movie" | "series";
  language: string;
  seasons: null;
  release_status: "released";
  tags: string;
};

export type RatingImportRow = {
  title: string;
  rating: string | null;
  infinity: boolean;
  shitty: boolean;
  recommendation: null;
  review: string;
  progress_status: "watched" | "watch_later";
  dropped_at_season: null;
  dropped_at_episode: null;
};

/** Normalize Bunko type → watchlist type. Movies→movie, Shows→series. */
export function mapBunkoType(raw: unknown): MapResult<"movie" | "series"> {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (s === "movies" || s === "movie") return { skip: false, value: "movie" };
  if (s === "shows" || s === "show" || s === "series") return { skip: false, value: "series" };
  return { skip: true, reason: `unknown type: ${String(raw ?? "")}` };
}

/** Normalize Bunko status → progress_status. watched→watched, watchlist→watch_later. */
export function mapBunkoStatus(raw: unknown): MapResult<"watched" | "watch_later"> {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (s === "watched") return { skip: false, value: "watched" };
  if (s === "watchlist") return { skip: false, value: "watch_later" };
  return { skip: true, reason: `unknown status: ${String(raw ?? "")}` };
}

/**
 * Rating 0–10 string; empty/missing → null; keep 0 as "0".
 */
export function mapBunkoRating(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  if (s === "") return null;
  const n = Number(s);
  if (Number.isNaN(n)) return null;
  // Preserve original string form for numeric column (e.g. "8.5")
  return s;
}

export function mapBunkoToCatalogRow(row: BunkoMovieRow, defaultLanguage: string): MapResult<CatalogImportRow> {
  const title = String(row.name ?? "").trim();
  if (!title) return { skip: true, reason: "title is required", raw: row };

  const type = mapBunkoType(row.type);
  if (type.skip) return { ...type, raw: row };

  const language = defaultLanguage.trim() || "English";

  return {
    skip: false,
    value: {
      title,
      type: type.value,
      language,
      seasons: null,
      release_status: "released",
      tags: "",
    },
  };
}

export function mapBunkoToRatingRow(row: BunkoMovieRow): MapResult<RatingImportRow> {
  const title = String(row.name ?? "").trim();
  if (!title) return { skip: true, reason: "title is required", raw: row };

  const status = mapBunkoStatus(row.status);
  if (status.skip) return { ...status, raw: row };

  return {
    skip: false,
    value: {
      title,
      rating: mapBunkoRating(row.rating),
      infinity: false,
      shitty: false,
      recommendation: null,
      review: "",
      progress_status: status.value,
      dropped_at_season: null,
      dropped_at_episode: null,
    },
  };
}

export function mapBunkoRows(
  rows: BunkoMovieRow[],
  defaultLanguage: string
): {
  catalog: CatalogImportRow[];
  ratings: RatingImportRow[];
  mapErrors: Array<{ index: number; message: string }>;
} {
  const catalog: CatalogImportRow[] = [];
  const ratings: RatingImportRow[] = [];
  const mapErrors: Array<{ index: number; message: string }> = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const cat = mapBunkoToCatalogRow(row, defaultLanguage);
    if (cat.skip) {
      mapErrors.push({ index: i, message: cat.reason });
      continue;
    }
    const rating = mapBunkoToRatingRow(row);
    if (rating.skip) {
      mapErrors.push({ index: i, message: rating.reason });
      continue;
    }
    catalog.push(cat.value);
    ratings.push(rating.value);
  }

  return { catalog, ratings, mapErrors };
}
