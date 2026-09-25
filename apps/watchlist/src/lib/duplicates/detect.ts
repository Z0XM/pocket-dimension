/**
 * Server-side duplicate group detection — cheap SQL for direct/indirect,
 * deferred in-memory fuzzy when requested.
 */
import { db, schema } from "@pocket-dimension/db";
import { eq, inArray, sql } from "drizzle-orm";
import {
  alphanumericKey,
  clusterFingerprint,
  findDuplicateClusters,
  normalizeTitle,
  type CatalogItemForMatching,
  type DuplicateCluster,
  type DuplicateTier,
  DEFAULT_FUZZY_THRESHOLD,
} from "./normalize";

export type GroupRef = {
  tier: DuplicateTier;
  fingerprint: string;
  ids: string[];
  confidence: number;
};

export type DuplicateSummary = {
  catalogSize: number;
  counts: {
    total: number;
    direct: number;
    indirect: number;
    fuzzy: number | null;
  };
  involvedItems: {
    direct: number;
    indirect: number;
    fuzzy: number | null;
  };
  fuzzyStatus: "ready" | "deferred";
};

function asIdArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") {
    // postgres sometimes returns "{uuid,uuid}"
    const inner = value.replace(/^\{|\}$/g, "");
    if (!inner) return [];
    return inner.split(",").map((s) => s.trim().replace(/^"|"$/g, ""));
  }
  return [];
}

export async function loadDismissedFingerprints(): Promise<Set<string>> {
  const rows = await db.select({ fingerprint: schema.duplicateDismissals.fingerprint }).from(schema.duplicateDismissals);
  return new Set(rows.map((r) => r.fingerprint));
}

/** Direct duplicate groups via SQL (normalized trim+lower title). */
export async function listDirectGroupRefs(): Promise<GroupRef[]> {
  const result = await db.execute(sql`
    select
      lower(btrim(title)) as key,
      array_agg(id order by id) as ids
    from watchlist.watch_items
    group by 1
    having count(*) >= 2
    order by count(*) desc, min(title) asc
  `);

  return result.rows.map((row) => {
    const ids = asIdArray(row.ids);
    const fingerprint = clusterFingerprint(ids);
    return { tier: "direct" as const, fingerprint, ids, confidence: 1 };
  });
}

/**
 * Indirect groups: match-key (alphanumeric of significant words; stop-words /
 * symbols ignored), excluding groups already identical to a direct cluster fingerprint.
 */
export async function listIndirectGroupRefs(directFingerprints?: Set<string>): Promise<GroupRef[]> {
  const directSet = directFingerprints ?? new Set((await listDirectGroupRefs()).map((g) => g.fingerprint));

  // Strip short stop-words then non-alphanumerics so "The Matrix" ≡ "Matrix"
  // and "Foo and Bar" ≡ "Foo & Bar". Keep in sync with matchingKey() in normalize.ts.
  // Bound as a param so Postgres receives real \m / \M word-boundary escapes
  // (inline template strings eat backslashes).
  const stopWordPattern = "\\m(a|an|and|or|the|of|to|in|on|at|for|vs|versus|with|by|from)\\M";

  const result = await db.execute(sql`
    select
      regexp_replace(
        regexp_replace(
          regexp_replace(lower(title), '[^a-z0-9]+', ' ', 'g'),
          ${stopWordPattern},
          '',
          'g'
        ),
        '[^a-z0-9]',
        '',
        'g'
      ) as key,
      array_agg(id order by id) as ids,
      array_agg(lower(btrim(title)) order by id) as norms
    from watchlist.watch_items
    where regexp_replace(
      regexp_replace(
        regexp_replace(lower(title), '[^a-z0-9]+', ' ', 'g'),
        ${stopWordPattern},
        '',
        'g'
      ),
      '[^a-z0-9]',
      '',
      'g'
    ) <> ''
    group by 1
    having count(*) >= 2
    order by count(*) desc, min(title) asc
  `);

  const out: GroupRef[] = [];
  for (const row of result.rows) {
    const ids = asIdArray(row.ids);
    if (ids.length < 2) continue;
    const fingerprint = clusterFingerprint(ids);
    if (directSet.has(fingerprint)) continue;

    // Skip if every title normalizes identically AND they're all already in a direct group
    // (same as findDuplicateClusters logic for fully-claimed same-norm groups)
    const norms = asIdArray(row.norms);
    const uniqueNorms = new Set(norms);
    if (uniqueNorms.size <= 1) {
      // Pure case/whitespace variants → already covered by direct
      continue;
    }

    out.push({ tier: "indirect", fingerprint, ids, confidence: 1 });
  }
  return out;
}

/** Lightweight catalog rows for fuzzy matching (no language join). */
export async function loadCatalogForFuzzy(): Promise<CatalogItemForMatching[]> {
  const rows = await db
    .select({
      id: schema.watchItems.id,
      title: schema.watchItems.title,
      type: schema.watchItems.type,
      languageId: schema.watchItems.languageId,
    })
    .from(schema.watchItems);
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    type: r.type,
    languageId: r.languageId,
    language: null,
  }));
}

/** Fuzzy group refs — runs in-memory on title rows; call only when needed. */
export async function listFuzzyGroupRefs(options: {
  fuzzyThreshold?: number;
  dismissed?: Set<string>;
} = {}): Promise<GroupRef[]> {
  const items = await loadCatalogForFuzzy();
  // Reuse findDuplicateClusters but only keep fuzzy tier by claiming direct/indirect first
  const all = findDuplicateClusters(items, {
    fuzzyThreshold: options.fuzzyThreshold ?? DEFAULT_FUZZY_THRESHOLD,
  });
  return all
    .filter((c) => c.tier === "fuzzy")
    .map((c) => ({
      tier: "fuzzy" as const,
      fingerprint: c.fingerprint,
      ids: c.members.map((m) => m.id),
      confidence: c.confidence,
    }));
}

export function filterDismissed(refs: GroupRef[], dismissed: Set<string>, includeDismissed: boolean): GroupRef[] {
  if (includeDismissed) return refs;
  return refs.filter((r) => !dismissed.has(r.fingerprint));
}

export async function getDuplicateSummary(options: {
  includeDismissed?: boolean;
  includeFuzzy?: boolean;
  fuzzyThreshold?: number;
} = {}): Promise<DuplicateSummary> {
  const includeDismissed = options.includeDismissed ?? false;
  const [catalogSizeRow, dismissed, directRefs] = await Promise.all([
    db.execute(sql`select count(*)::int as n from watchlist.watch_items`),
    loadDismissedFingerprints(),
    listDirectGroupRefs(),
  ]);
  const catalogSize = Number(catalogSizeRow.rows[0]?.n ?? 0);
  const directFp = new Set(directRefs.map((r) => r.fingerprint));
  const indirectRefs = await listIndirectGroupRefs(directFp);

  const direct = filterDismissed(directRefs, dismissed, includeDismissed);
  const indirect = filterDismissed(indirectRefs, dismissed, includeDismissed);

  let fuzzy: GroupRef[] | null = null;
  let fuzzyStatus: "ready" | "deferred" = "deferred";
  if (options.includeFuzzy) {
    fuzzy = filterDismissed(
      await listFuzzyGroupRefs({ fuzzyThreshold: options.fuzzyThreshold, dismissed }),
      dismissed,
      includeDismissed
    );
    fuzzyStatus = "ready";
  }

  const fuzzyCount = fuzzy ? fuzzy.length : null;
  const fuzzyItems = fuzzy ? new Set(fuzzy.flatMap((g) => g.ids)).size : null;

  return {
    catalogSize,
    counts: {
      total: direct.length + indirect.length + (fuzzyCount ?? 0),
      direct: direct.length,
      indirect: indirect.length,
      fuzzy: fuzzyCount,
    },
    involvedItems: {
      direct: new Set(direct.flatMap((g) => g.ids)).size,
      indirect: new Set(indirect.flatMap((g) => g.ids)).size,
      fuzzy: fuzzyItems,
    },
    fuzzyStatus,
  };
}

export async function listGroupRefsPage(options: {
  tier: DuplicateTier | "all";
  limit: number;
  offset: number;
  includeDismissed?: boolean;
  fuzzyThreshold?: number;
}): Promise<{
  refs: GroupRef[];
  totalMatching: number;
  counts: DuplicateSummary["counts"];
  fuzzyStatus: "ready" | "deferred";
  /** True when more pages may exist beyond known direct/indirect (fuzzy not scanned yet). */
  fuzzyPending: boolean;
}> {
  const includeDismissed = options.includeDismissed ?? false;
  const dismissed = await loadDismissedFingerprints();

  // Fuzzy-only path
  if (options.tier === "fuzzy") {
    const fuzzyRefs = filterDismissed(
      await listFuzzyGroupRefs({ fuzzyThreshold: options.fuzzyThreshold, dismissed }),
      dismissed,
      includeDismissed
    );
    const refs = fuzzyRefs.slice(options.offset, options.offset + options.limit);
    return {
      refs,
      totalMatching: fuzzyRefs.length,
      counts: { total: fuzzyRefs.length, direct: 0, indirect: 0, fuzzy: fuzzyRefs.length },
      fuzzyStatus: "ready",
      fuzzyPending: false,
    };
  }

  const directRefs = options.tier === "indirect" ? [] : await listDirectGroupRefs();
  const directFp = new Set(directRefs.map((r) => r.fingerprint));
  const indirectRefs = options.tier === "direct" ? [] : await listIndirectGroupRefs(directFp);

  const direct = filterDismissed(directRefs, dismissed, includeDismissed);
  const indirect = filterDismissed(indirectRefs, dismissed, includeDismissed);
  const exactOrdered = [...direct, ...indirect];

  // For tier=all: only run expensive fuzzy once the client pages past exact matches.
  const needsFuzzyNow = options.tier === "all" && options.offset >= exactOrdered.length;

  let fuzzy: GroupRef[] = [];
  let fuzzyStatus: "ready" | "deferred" = "deferred";
  if (needsFuzzyNow) {
    fuzzy = filterDismissed(
      await listFuzzyGroupRefs({ fuzzyThreshold: options.fuzzyThreshold, dismissed }),
      dismissed,
      includeDismissed
    );
    fuzzyStatus = "ready";
  }

  let ordered: GroupRef[];
  if (options.tier === "direct") ordered = direct;
  else if (options.tier === "indirect") ordered = indirect;
  else ordered = [...exactOrdered, ...fuzzy];

  const refs = ordered.slice(options.offset, options.offset + options.limit);
  const fuzzyPending = options.tier === "all" && fuzzyStatus === "deferred";
  // While fuzzy is deferred, totalMatching is a lower bound (exact only); hasMore stays true.
  const totalMatching = fuzzyPending ? exactOrdered.length : ordered.length;

  return {
    refs,
    totalMatching,
    counts: {
      total: exactOrdered.length + (fuzzyStatus === "ready" ? fuzzy.length : 0),
      direct: direct.length,
      indirect: indirect.length,
      fuzzy: fuzzyStatus === "ready" ? fuzzy.length : null,
    },
    fuzzyStatus,
    fuzzyPending,
  };
}

/** Hydrate group refs into full clusters with language + rating stats. */
export async function hydrateGroupRefs(
  refs: GroupRef[],
  dismissed: Set<string>
): Promise<
  Array<
    DuplicateCluster & {
      dismissed: boolean;
      totalRatings: number;
      sampleRaters: string[];
      memberStats: Array<{
        id: string;
        title: string;
        type: string;
        language: string | null;
        ratingCount: number;
      }>;
    }
  >
> {
  if (refs.length === 0) return [];

  const allIds = [...new Set(refs.flatMap((r) => r.ids))];
  const items = await db
    .select({
      id: schema.watchItems.id,
      title: schema.watchItems.title,
      type: schema.watchItems.type,
      languageId: schema.watchItems.languageId,
      language: schema.watchLanguages.language,
    })
    .from(schema.watchItems)
    .leftJoin(schema.watchLanguages, eq(schema.watchItems.languageId, schema.watchLanguages.id))
    .where(inArray(schema.watchItems.id, allIds));

  const byId = new Map(items.map((i) => [i.id, i]));

  const ratingRows = await db
    .select({
      watchItemId: schema.watchItemRatings.watchItemId,
      userId: schema.watchItemRatings.userId,
      username: schema.user.username,
    })
    .from(schema.watchItemRatings)
    .leftJoin(schema.user, eq(schema.watchItemRatings.userId, schema.user.id))
    .where(inArray(schema.watchItemRatings.watchItemId, allIds));

  const countByItem = new Map<string, number>();
  const ratersByItem = new Map<string, string[]>();
  for (const r of ratingRows) {
    countByItem.set(r.watchItemId, (countByItem.get(r.watchItemId) ?? 0) + 1);
    if (r.username) {
      const list = ratersByItem.get(r.watchItemId) ?? [];
      if (!list.includes(r.username)) list.push(r.username);
      ratersByItem.set(r.watchItemId, list);
    }
  }

  return refs.map((ref) => {
    const members = ref.ids
      .map((id) => byId.get(id))
      .filter(Boolean)
      .map((i) => ({
        id: i!.id,
        title: i!.title,
        type: i!.type,
        languageId: i!.languageId,
        language: i!.language ?? null,
      }));

    const memberStats = members.map((m) => ({
      id: m.id,
      title: m.title,
      type: m.type,
      language: m.language,
      ratingCount: countByItem.get(m.id) ?? 0,
    }));

    const sampleRaters = [...new Set(members.flatMap((m) => (ratersByItem.get(m.id) ?? []).slice(0, 4)))].slice(0, 8);

    return {
      id: `${ref.tier}:${ref.fingerprint}`,
      tier: ref.tier,
      confidence: ref.confidence,
      fingerprint: ref.fingerprint,
      members,
      dismissed: dismissed.has(ref.fingerprint),
      totalRatings: memberStats.reduce((n, m) => n + m.ratingCount, 0),
      sampleRaters,
      memberStats,
    };
  });
}

// Re-export helpers used by tests / callers that still want in-memory full scan
export {
  normalizeTitle,
  alphanumericKey,
  matchingKey,
  normalizeForMatch,
  parseSequelParts,
  titlesAreDistinctSequels,
};
