import type { SearchCorpusEntry, SearchHit, SearchHitKind, TreeId } from "$lib/types";

const KIND_ORDER: SearchHitKind[] = ["feature", "epic", "story", "test", "docs"];

const GROUP_LABELS: Record<SearchHitKind, string> = {
  feature: "Feature",
  epic: "Epic",
  story: "Story",
  test: "Test",
  docs: "Docs",
};

export { GROUP_LABELS, KIND_ORDER };

/** Case-insensitive: full query as substring OR every whitespace token appears as substring. */
export function matchesQuery(haystack: string, query: string): boolean {
  const needle = query.trim();
  if (!needle) {
    return false;
  }

  const lowerHaystack = haystack.toLowerCase();
  const lowerNeedle = needle.toLowerCase();

  if (lowerHaystack.includes(lowerNeedle)) {
    return true;
  }

  const tokens = lowerNeedle.split(/\s+/).filter(Boolean);
  if (tokens.length <= 1) {
    return false;
  }

  return tokens.every((token) => lowerHaystack.includes(token));
}

/** ~80–120 chars around first match; plain text. */
export function buildSnippet(haystack: string, query: string, radius = 50): string {
  const needle = query.trim();
  if (!needle) {
    return "";
  }

  const lowerHaystack = haystack.toLowerCase();
  const lowerNeedle = needle.toLowerCase();

  let matchIndex = lowerHaystack.indexOf(lowerNeedle);
  let matchLength = lowerNeedle.length;

  if (matchIndex === -1) {
    const tokens = lowerNeedle.split(/\s+/).filter(Boolean);
    for (const token of tokens) {
      const idx = lowerHaystack.indexOf(token);
      if (idx !== -1) {
        matchIndex = idx;
        matchLength = token.length;
        break;
      }
    }
  }

  if (matchIndex === -1) {
    const trimmed = haystack.trim();
    return trimmed.length <= radius * 2 ? trimmed : `${trimmed.slice(0, radius * 2)}…`;
  }

  const start = Math.max(0, matchIndex - radius);
  const end = Math.min(haystack.length, matchIndex + matchLength + radius);
  let snippet = haystack.slice(start, end).trim();

  if (start > 0) {
    snippet = `…${snippet}`;
  }
  if (end < haystack.length) {
    snippet = `${snippet}…`;
  }

  return snippet;
}

export type SearchOptions = {
  /** When set, only entries with this tree. Default = all corpus. */
  tree?: TreeId | null;
};

/** Stable order: group order Feature → Epic → Story → Test → Docs, then path/title. No ranking scores. */
export function searchCorpus(corpus: SearchCorpusEntry[], query: string, options?: SearchOptions): SearchHit[] {
  const needle = query.trim();
  if (!needle) {
    return [];
  }

  const treeFilter = options?.tree ?? null;

  const hits: SearchHit[] = [];

  for (const entry of corpus) {
    if (treeFilter && entry.tree !== treeFilter) {
      continue;
    }

    if (!matchesQuery(entry.text, needle)) {
      continue;
    }

    hits.push({
      kind: entry.kind,
      id: entry.id,
      title: entry.title,
      snippet: buildSnippet(entry.text, needle),
      href: entry.href,
      tree: entry.tree,
    });
  }

  hits.sort((a, b) => {
    const kindDiff = KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind);
    if (kindDiff !== 0) {
      return kindDiff;
    }

    const titleDiff = a.title.localeCompare(b.title);
    if (titleDiff !== 0) {
      return titleDiff;
    }

    return a.id.localeCompare(b.id);
  });

  return hits;
}

/** Group hits by kind for overlay rendering; omits empty groups. */
export function groupSearchHits(hits: SearchHit[]): { kind: SearchHitKind; label: string; hits: SearchHit[] }[] {
  const groups: { kind: SearchHitKind; label: string; hits: SearchHit[] }[] = [];

  for (const kind of KIND_ORDER) {
    const kindHits = hits.filter((hit) => hit.kind === kind);
    if (kindHits.length === 0) {
      continue;
    }
    groups.push({ kind, label: GROUP_LABELS[kind], hits: kindHits });
  }

  return groups;
}
