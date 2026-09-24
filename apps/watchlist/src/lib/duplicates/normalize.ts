/**
 * Title normalization & matching helpers for duplicate detection.
 */

/** Trim + collapse whitespace + lowercase for exact-ish comparison. */
export function normalizeTitle(title: string): string {
  return title.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Keep only a–z / 0–9 in order (strip symbols, spaces, punctuation). */
export function alphanumericKey(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Unicode-aware Levenshtein distance. */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j <= b.length; j++) {
      const cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

/**
 * Similarity in [0, 1] from Levenshtein on normalized titles.
 * 1 = identical, 0 = completely different.
 */
export function titleSimilarity(a: string, b: string): number {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  if (!na && !nb) return 1;
  if (!na || !nb) return 0;
  const dist = levenshtein(na, nb);
  const maxLen = Math.max(na.length, nb.length);
  if (maxLen === 0) return 1;
  return 1 - dist / maxLen;
}

/** Default fuzzy threshold — close but not exact / alphanumeric-identical. */
export const DEFAULT_FUZZY_THRESHOLD = 0.82;

/** Stable fingerprint for a set of watch item ids (for dismissals). */
export function clusterFingerprint(itemIds: string[]): string {
  return [...itemIds].sort().join("|");
}

export type DuplicateTier = "direct" | "indirect" | "fuzzy";

export type CatalogItemForMatching = {
  id: string;
  title: string;
  type: string;
  languageId: string;
  language?: string | null;
};

export type DuplicateClusterMember = {
  id: string;
  title: string;
  type: string;
  languageId: string;
  language: string | null;
};

export type DuplicateCluster = {
  id: string;
  tier: DuplicateTier;
  /** Confidence 0–1; direct/indirect are 1; fuzzy uses similarity. */
  confidence: number;
  fingerprint: string;
  members: DuplicateClusterMember[];
};

/**
 * Build duplicate clusters from catalog items.
 * Direct and indirect take precedence; fuzzy only links items not already
 * paired via a stronger tier (union-find style within fuzzy pairs).
 */
export function findDuplicateClusters(
  items: CatalogItemForMatching[],
  options: { fuzzyThreshold?: number; maxFuzzyPairsPerItem?: number } = {}
): DuplicateCluster[] {
  const fuzzyThreshold = options.fuzzyThreshold ?? DEFAULT_FUZZY_THRESHOLD;
  const maxFuzzyPairsPerItem = options.maxFuzzyPairsPerItem ?? 8;

  const byDirect = new Map<string, CatalogItemForMatching[]>();
  const byAlpha = new Map<string, CatalogItemForMatching[]>();

  for (const item of items) {
    const direct = normalizeTitle(item.title);
    if (direct) {
      const list = byDirect.get(direct) ?? [];
      list.push(item);
      byDirect.set(direct, list);
    }
    const alpha = alphanumericKey(item.title);
    if (alpha) {
      const list = byAlpha.get(alpha) ?? [];
      list.push(item);
      byAlpha.set(alpha, list);
    }
  }

  const claimed = new Set<string>(); // item ids already in a stronger cluster
  const clusters: DuplicateCluster[] = [];

  for (const [key, group] of byDirect) {
    if (group.length < 2) continue;
    const members = toMembers(group);
    const fingerprint = clusterFingerprint(members.map((m) => m.id));
    clusters.push({
      id: `direct:${fingerprint}`,
      tier: "direct",
      confidence: 1,
      fingerprint,
      members,
    });
    for (const m of members) claimed.add(m.id);
  }

  for (const [key, group] of byAlpha) {
    if (group.length < 2) continue;
    // Skip if every pair already covered by direct (same normalized title)
    const unclaimed = group.filter((g) => !claimed.has(g.id));
    // Also include claimed siblings so indirect clusters that mix with
    // differently-cased titles still surface remaining rows — but only if
    // the alphanumeric group isn't already fully represented by one direct cluster.
    const allIds = group.map((g) => g.id);
    const fingerprint = clusterFingerprint(allIds);
    const alreadyAsDirect = clusters.some((c) => c.tier === "direct" && c.fingerprint === fingerprint);
    if (alreadyAsDirect) continue;

    // Prefer clusters with at least 2 items not entirely identical under normalizeTitle
    const norms = new Set(group.map((g) => normalizeTitle(g.title)));
    if (norms.size <= 1 && group.every((g) => claimed.has(g.id))) continue;

    const members = toMembers(group);
    if (members.length < 2) continue;
    clusters.push({
      id: `indirect:${fingerprint}`,
      tier: "indirect",
      confidence: 1,
      fingerprint,
      members,
    });
    for (const m of members) claimed.add(m.id);
  }

  // Fuzzy: compare unclaimed items (plus soft matches to claimed only if both unclaimed)
  const fuzzyCandidates = items.filter((i) => !claimed.has(i.id));
  // Bucket by first alphanumeric char + length band to bound O(n²)
  const buckets = new Map<string, CatalogItemForMatching[]>();
  for (const item of fuzzyCandidates) {
    const alpha = alphanumericKey(item.title);
    if (alpha.length < 3) continue;
    const lenBand = Math.floor(alpha.length / 4);
    const prefix = alpha.slice(0, 2);
    const bucketKey = `${prefix}:${lenBand}`;
    const list = buckets.get(bucketKey) ?? [];
    list.push(item);
    buckets.set(bucketKey, list);
  }

  type Edge = { a: string; b: string; score: number };
  const edges: Edge[] = [];
  const pairSeen = new Set<string>();

  for (const bucket of buckets.values()) {
    if (bucket.length < 2) continue;
    for (let i = 0; i < bucket.length; i++) {
      let added = 0;
      for (let j = i + 1; j < bucket.length; j++) {
        const left = bucket[i];
        const right = bucket[j];
        // Skip alphanumeric-identical (would be indirect)
        if (alphanumericKey(left.title) === alphanumericKey(right.title)) continue;
        const score = titleSimilarity(left.title, right.title);
        if (score < fuzzyThreshold || score >= 1) continue;
        const pk = clusterFingerprint([left.id, right.id]);
        if (pairSeen.has(pk)) continue;
        pairSeen.add(pk);
        edges.push({ a: left.id, b: right.id, score });
        added++;
        if (added >= maxFuzzyPairsPerItem) break;
      }
    }
  }

  // Union-find fuzzy components
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let p = parent.get(x) ?? x;
    if (p !== x) {
      p = find(p);
      parent.set(x, p);
    }
    parent.set(x, p);
    return p;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  const minScore = new Map<string, number>(); // root -> min edge score in component
  for (const e of edges) {
    union(e.a, e.b);
  }
  for (const e of edges) {
    const root = find(e.a);
    const prev = minScore.get(root);
    minScore.set(root, prev == null ? e.score : Math.min(prev, e.score));
  }

  const byRoot = new Map<string, string[]>();
  for (const item of fuzzyCandidates) {
    if (!parent.has(item.id)) continue;
    const root = find(item.id);
    const list = byRoot.get(root) ?? [];
    list.push(item.id);
    byRoot.set(root, list);
  }

  const byId = new Map(items.map((i) => [i.id, i]));
  for (const [root, ids] of byRoot) {
    if (ids.length < 2) continue;
    const members = toMembers(ids.map((id) => byId.get(id)!).filter(Boolean));
    if (members.length < 2) continue;
    const fingerprint = clusterFingerprint(members.map((m) => m.id));
    const confidence = Math.round((minScore.get(root) ?? fuzzyThreshold) * 1000) / 1000;
    clusters.push({
      id: `fuzzy:${fingerprint}`,
      tier: "fuzzy",
      confidence,
      fingerprint,
      members,
    });
  }

  // Sort: direct → indirect → fuzzy, then by confidence desc, then size desc
  const tierOrder: Record<DuplicateTier, number> = { direct: 0, indirect: 1, fuzzy: 2 };
  clusters.sort((a, b) => {
    if (tierOrder[a.tier] !== tierOrder[b.tier]) return tierOrder[a.tier] - tierOrder[b.tier];
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return b.members.length - a.members.length;
  });

  return clusters;
}

function toMembers(items: CatalogItemForMatching[]): DuplicateClusterMember[] {
  return items.map((i) => ({
    id: i.id,
    title: i.title,
    type: i.type,
    languageId: i.languageId,
    language: i.language ?? null,
  }));
}
