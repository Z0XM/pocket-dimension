/**
 * Build a Features deep-link that preserves the current query string
 * (especially `?module=` Module Scope). Absolute `/features#…` paths drop search.
 */
export function normalizeSearch(search: string): string {
  const trimmed = search.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("?") ? trimmed : `?${trimmed}`;
}

export function featuresLocation(featureId: string | null | undefined, search: string): { pathname: string; search: string; hash: string } {
  const id = featureId?.replace(/^#/, "").trim() || "";
  return {
    pathname: "/features",
    search: normalizeSearch(search),
    hash: id ? `#${id}` : "",
  };
}

/** String form for APIs that only accept href strings (e.g. search hits). */
export function featuresHref(featureId: string | null | undefined, search: string): string {
  const loc = featuresLocation(featureId, search);
  return `${loc.pathname}${loc.search}${loc.hash}`;
}

/**
 * If `href` is a Features deep-link (with or without query), rebuild it with
 * the current `search` so Module Scope is preserved. Other hrefs pass through.
 */
export function scopedHref(href: string | null, search: string): string | null {
  if (!href) return null;
  if (!href.startsWith("/features")) return href;
  const hashIdx = href.indexOf("#");
  const featureId = hashIdx >= 0 ? href.slice(hashIdx + 1) : null;
  return featuresHref(featureId, search);
}
