import { collectTagNames, parseTagQuery, type TagQueryNode } from "./tag-query";

/** Tag option as shown in pickers. `slug` is what chip selections serialize to in a tag query. */
export type TagFilterTag = { id: string; name: string; kind: string; slug?: string };

export const TOP_TAG_LIMIT = 6;

/**
 * Pick the few tags shown as chips: the user's most-used tags first, topped up with the most-used
 * system tags (catalogue-wide), then any remaining system tags by name. Custom tags the user never
 * applied are left for the dropdown.
 */
export function rankTopTagIds(
  tags: TagFilterTag[],
  usage: { userCounts: Map<string, number>; globalCounts: Map<string, number> },
  limit = TOP_TAG_LIMIT
): string[] {
  const byName = (a: TagFilterTag, b: TagFilterTag) => a.name.localeCompare(b.name);
  const mine = (id: string) => usage.userCounts.get(id) ?? 0;
  const global = (id: string) => usage.globalCounts.get(id) ?? 0;

  const used = tags.filter((t) => mine(t.id) > 0).sort((a, b) => mine(b.id) - mine(a.id) || byName(a, b));
  const system = tags.filter((t) => t.kind === "system" && mine(t.id) === 0).sort((a, b) => global(b.id) - global(a.id) || byName(a, b));

  return [...used, ...system].slice(0, Math.max(limit, 0)).map((t) => t.id);
}

function tagToken(tag: TagFilterTag): string {
  return tag.slug || tag.name;
}

/** Serialize AND-ed chip selections as an equivalent tag query (`lofi and chill`). Unknown ids are dropped. */
export function tagIdsToQuery(tagIds: string[], tags: TagFilterTag[]): string {
  const byId = new Map(tags.map((t) => [t.id, t]));
  return [...new Set(tagIds)]
    .map((id) => byId.get(id))
    .filter((t): t is TagFilterTag => Boolean(t))
    .map(tagToken)
    .join(" and ");
}

/** The tag query a filter state stands for: the typed query wins, otherwise the AND of selected chips. */
export function effectiveTagQuery(input: { tagQuery?: string | null; tagIds?: string[] }, tags: TagFilterTag[]): string {
  const typed = input.tagQuery?.trim() ?? "";
  if (typed) return typed;
  return tagIdsToQuery(input.tagIds ?? [], tags);
}

function tagNameLookup(tags: TagFilterTag[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const t of tags) {
    map.set(t.name.toLowerCase(), t.id);
    if (t.slug) map.set(t.slug.toLowerCase(), t.id);
  }
  return map;
}

/** Client-side check of a typed tag query: syntax errors and tags the user can't filter by. Null when fine or empty. */
export function tagQueryProblem(tagQuery: string, tags: TagFilterTag[]): string | null {
  if (!tagQuery.trim()) return null;
  const parsed = parseTagQuery(tagQuery);
  if (!parsed.ok) return parsed.error;
  const lookup = tagNameLookup(tags);
  const missing = [...collectTagNames(parsed.ast)].filter((name) => !lookup.has(name));
  return missing.length ? `Unknown tag${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}` : null;
}

/** Drop double negation and flatten nested AND/AND and OR/OR. */
function simplify(node: TagQueryNode): TagQueryNode {
  switch (node.type) {
    case "tag":
      return node;
    case "not": {
      const child = simplify(node.child);
      return child.type === "not" ? child.child : { type: "not", child };
    }
    case "and":
    case "or": {
      const children = node.children.map(simplify).flatMap((c) => (c.type === node.type ? c.children : [c]));
      return { type: node.type, children };
    }
  }
}

function canonical(node: TagQueryNode, resolve: (name: string) => string | null): string | null {
  switch (node.type) {
    case "tag": {
      const id = resolve(node.name);
      return id ? `#${id}` : null;
    }
    case "not": {
      const inner = canonical(node.child, resolve);
      return inner ? `not(${inner})` : null;
    }
    case "and":
    case "or": {
      const parts = new Set<string>();
      for (const c of node.children) {
        const key = canonical(c, resolve);
        if (!key) return null;
        parts.add(key);
      }
      const sorted = [...parts].sort();
      if (sorted.length === 1) return sorted[0]!;
      return `${node.type}(${sorted.join(",")})`;
    }
  }
}

/**
 * Canonical key for "same tag filter" checks between the catalogue and saved playlists.
 * Tag leaves resolve (by name or slug, case-insensitive) to tag ids; AND/OR operands are flattened,
 * deduped and sorted; double NOT collapses. So `chill and lofi`, `Lofi (chill)` and the chips
 * [lofi, chill] all share a key, while `chill or lofi` does not. Returns null for an empty,
 * unparsable, or unresolvable filter.
 */
export function tagFilterKey(input: { tagQuery?: string | null; tagIds?: string[] }, tags: TagFilterTag[]): string | null {
  const typed = input.tagQuery?.trim() ?? "";
  if (!typed) {
    const known = new Set(tags.map((t) => t.id));
    const ids = [...new Set(input.tagIds ?? [])].filter((id) => known.has(id)).sort();
    if (ids.length === 0) return null;
    return ids.length === 1 ? `#${ids[0]}` : `and(${ids.map((id) => `#${id}`).join(",")})`;
  }
  const parsed = parseTagQuery(typed);
  if (!parsed.ok) return null;
  const lookup = tagNameLookup(tags);
  return canonical(simplify(parsed.ast), (name) => lookup.get(name.toLowerCase()) ?? null);
}

/** First playlist whose stored tag query has the same canonical key as the current filter. */
export function findPlaylistMatchingTagFilter<P extends { tagQuery: string | null }>(
  filter: { tagQuery?: string | null; tagIds?: string[] },
  playlists: P[],
  tags: TagFilterTag[]
): P | null {
  const key = tagFilterKey(filter, tags);
  if (!key) return null;
  return playlists.find((p) => p.tagQuery && tagFilterKey({ tagQuery: p.tagQuery }, tags) === key) ?? null;
}
