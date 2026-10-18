/** `playlist` narrows to one playlist's tracks (in playlist order) — requires `playlistId`. */
export type CatalogueScope = "all" | "yours" | "playlist";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Read scope from search params (`?scope=all|yours`, `?playlist=<id>`). The catalogue page defaults to
 * “Your library”; the JSON API keeps defaulting to `all` (session add-from-catalogue relies on it).
 */
export function parseCatalogueScope(params: URLSearchParams, fallback: "all" | "yours"): { scope: CatalogueScope; playlistId: string | null } {
  const playlistId = params.get("playlist")?.trim() || null;
  if (playlistId && UUID_RE.test(playlistId)) return { scope: "playlist", playlistId };
  const raw = params.get("scope");
  if (raw === "all" || raw === "yours") return { scope: raw, playlistId: null };
  return { scope: fallback, playlistId: null };
}
