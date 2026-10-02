import { normalizeMerchant, rankFuzzyMerchants } from "$lib/finance/merchant-match";
import type { ImportClassificationSuggestion, ImportPreviewRow, ImportPreviewTaxonomy } from "$lib/importers/types";
import { db, schema } from "@pocket-dimension/db";
import { asc, eq, inArray, sql } from "drizzle-orm";

type TxType = "expense" | "income" | "transfer";

type MerchantIntel = {
  merchant: string;
  categoryId: string | null;
  categoryName: string | null;
  categoryCount: number;
  categoryTotal: number;
  tagIds: string[];
  tagNames: string[];
  tagCount: number;
  tagTotal: number;
};

type CategoryBucket = {
  categoryId: string | null;
  categoryName: string;
  count: number;
};

type TagProfile = {
  tagIds: string[];
  tagNames: string[];
  count: number;
};

export type ResolvedImportAssignment = {
  setCategory: boolean;
  categoryId: string | null;
  tagIds: string[];
};

function pickBestCategory(buckets: CategoryBucket[]): CategoryBucket | null {
  if (!buckets.length) return null;
  const categorized = buckets.filter((bucket) => bucket.categoryId != null);
  const pool = categorized.length ? categorized : buckets;
  return [...pool].sort((a, b) => b.count - a.count || a.categoryName.localeCompare(b.categoryName))[0] ?? null;
}

function pickBestTagProfile(profiles: TagProfile[]): TagProfile | null {
  const withTags = profiles.filter((profile) => profile.tagIds.length > 0);
  if (!withTags.length) return null;
  return [...withTags].sort((a, b) => b.count - a.count || a.tagNames.join(",").localeCompare(b.tagNames.join(",")))[0] ?? null;
}

function tagProfileKey(tagIds: string[]): string {
  return tagIds.length ? [...tagIds].sort().join(",") : "__none__";
}

async function buildMerchantIntelMap(accountId: string, type: TxType): Promise<Map<string, MerchantIntel>> {
  const categoryResult = await db.execute(sql`
    select
      lower(trim(t.merchant)) as merchant_key,
      min(trim(t.merchant)) as merchant,
      t.category_id,
      coalesce(c.name, 'Uncategorized') as category_name,
      count(*)::int as row_count
    from chhanchhan.finance_transactions t
    left join chhanchhan.finance_categories c on c.id = t.category_id
    where t.account_id = ${accountId}
      and t.type = ${type}
      and t.merchant is not null
      and trim(t.merchant) != ''
    group by lower(trim(t.merchant)), t.category_id, c.name
  `);

  const bucketsByMerchant = new Map<string, { merchant: string; buckets: CategoryBucket[]; total: number }>();
  for (const row of categoryResult.rows) {
    const typed = row as {
      merchant_key: string;
      merchant: string;
      category_id: string | null;
      category_name: string;
      row_count: number;
    };
    const key = String(typed.merchant_key);
    const existing = bucketsByMerchant.get(key) ?? { merchant: String(typed.merchant), buckets: [], total: 0 };
    existing.merchant = String(typed.merchant);
    existing.buckets.push({
      categoryId: typed.category_id ?? null,
      categoryName: String(typed.category_name),
      count: Number(typed.row_count),
    });
    existing.total += Number(typed.row_count);
    bucketsByMerchant.set(key, existing);
  }

  const txResult = await db.execute(sql`
    select
      t.id,
      lower(trim(t.merchant)) as merchant_key,
      trim(t.merchant) as merchant
    from chhanchhan.finance_transactions t
    where t.account_id = ${accountId}
      and t.type = ${type}
      and t.merchant is not null
      and trim(t.merchant) != ''
  `);

  const txIds: string[] = [];
  const merchantByTx = new Map<string, { key: string; merchant: string }>();
  for (const row of txResult.rows) {
    const typed = row as { id: string; merchant_key: string; merchant: string };
    txIds.push(String(typed.id));
    merchantByTx.set(String(typed.id), { key: String(typed.merchant_key), merchant: String(typed.merchant) });
  }

  const profilesByMerchant = new Map<string, { merchant: string; profiles: Map<string, TagProfile>; total: number }>();

  if (txIds.length) {
    const tagRows = await db
      .select({
        transactionId: schema.financeTransactionTags.transactionId,
        id: schema.financeTags.id,
        name: schema.financeTags.name,
      })
      .from(schema.financeTransactionTags)
      .innerJoin(schema.financeTags, eq(schema.financeTags.id, schema.financeTransactionTags.tagId))
      .where(inArray(schema.financeTransactionTags.transactionId, txIds))
      .orderBy(asc(schema.financeTags.name));

    const tagsByTx = new Map<string, Array<{ id: string; name: string }>>();
    for (const row of tagRows) {
      const list = tagsByTx.get(row.transactionId) ?? [];
      list.push({ id: row.id, name: row.name });
      tagsByTx.set(row.transactionId, list);
    }

    for (const [transactionId, meta] of merchantByTx) {
      const tags = tagsByTx.get(transactionId) ?? [];
      const tagIds = tags.map((tag) => tag.id).sort();
      const key = tagProfileKey(tagIds);
      const existing = profilesByMerchant.get(meta.key) ?? {
        merchant: meta.merchant,
        profiles: new Map<string, TagProfile>(),
        total: 0,
      };
      existing.merchant = meta.merchant;
      existing.total += 1;
      const profile = existing.profiles.get(key);
      if (profile) {
        profile.count += 1;
      } else {
        existing.profiles.set(key, {
          tagIds,
          tagNames: tags.map((tag) => tag.name),
          count: 1,
        });
      }
      profilesByMerchant.set(meta.key, existing);
    }
  }

  const intel = new Map<string, MerchantIntel>();
  const keys = new Set([...bucketsByMerchant.keys(), ...profilesByMerchant.keys()]);

  for (const key of keys) {
    const categoryMeta = bucketsByMerchant.get(key);
    const tagMeta = profilesByMerchant.get(key);
    const bestCategory = categoryMeta ? pickBestCategory(categoryMeta.buckets) : null;
    const bestTags = tagMeta ? pickBestTagProfile([...tagMeta.profiles.values()]) : null;
    const merchant = categoryMeta?.merchant ?? tagMeta?.merchant ?? key;

    intel.set(key, {
      merchant,
      categoryId: bestCategory?.categoryId ?? null,
      categoryName: bestCategory?.categoryId ? bestCategory.categoryName : null,
      categoryCount: bestCategory?.count ?? 0,
      categoryTotal: categoryMeta?.total ?? 0,
      tagIds: bestTags?.tagIds ?? [],
      tagNames: bestTags?.tagNames ?? [],
      tagCount: bestTags?.count ?? 0,
      tagTotal: tagMeta?.total ?? 0,
    });
  }

  return intel;
}

function suggestionFromIntel(intel: MerchantIntel, source: "exact" | "fuzzy"): ImportClassificationSuggestion | null {
  const hasCategory = Boolean(intel.categoryId);
  const hasTags = intel.tagIds.length > 0;
  if (!hasCategory && !hasTags) return null;

  return {
    categoryId: intel.categoryId,
    categoryName: intel.categoryName,
    tagIds: [...intel.tagIds],
    tagNames: [...intel.tagNames],
    source,
    matchedMerchant: intel.merchant,
    sampleCount: Math.max(intel.categoryCount, intel.tagCount, 1),
  };
}

export async function suggestImportClassifications(
  accountId: string,
  rows: ImportPreviewRow[]
): Promise<Map<number, ImportClassificationSuggestion | null>> {
  const suggestions = new Map<number, ImportClassificationSuggestion | null>();
  const eligible = rows.filter(
    (row) => (row.status === "will_import" || row.status === "warning") && Boolean(row.merchant?.trim()) && Boolean(row.type)
  );

  if (!eligible.length) return suggestions;

  const byType = new Map<TxType, ImportPreviewRow[]>();
  for (const row of eligible) {
    const type = row.type as TxType;
    const list = byType.get(type) ?? [];
    list.push(row);
    byType.set(type, list);
  }

  for (const [type, typeRows] of byType) {
    const intelByKey = await buildMerchantIntelMap(accountId, type);
    const knownMerchants = [...intelByKey.values()].map((entry) => entry.merchant);

    for (const row of typeRows) {
      const merchant = row.merchant!.trim();
      const exact = intelByKey.get(normalizeMerchant(merchant));
      if (exact) {
        suggestions.set(row.row, suggestionFromIntel(exact, "exact"));
        continue;
      }

      const fuzzyMatch = rankFuzzyMerchants(merchant, knownMerchants, 1)[0];
      if (!fuzzyMatch) {
        suggestions.set(row.row, null);
        continue;
      }

      const fuzzy = intelByKey.get(normalizeMerchant(fuzzyMatch));
      suggestions.set(row.row, fuzzy ? suggestionFromIntel(fuzzy, "fuzzy") : null);
    }
  }

  return suggestions;
}

export async function enrichPreviewRowsWithSuggestions(accountId: string, rows: ImportPreviewRow[]): Promise<void> {
  const suggestions = await suggestImportClassifications(accountId, rows);
  for (const row of rows) {
    if (suggestions.has(row.row)) {
      row.suggestion = suggestions.get(row.row) ?? null;
    }
  }
}

export async function loadImportTaxonomy(accountId: string): Promise<ImportPreviewTaxonomy> {
  const [categories, tags] = await Promise.all([
    db
      .select({
        id: schema.financeCategories.id,
        name: schema.financeCategories.name,
        kind: schema.financeCategories.kind,
        colorHex: schema.financeCategories.colorHex,
      })
      .from(schema.financeCategories)
      .where(eq(schema.financeCategories.accountId, accountId))
      .orderBy(asc(schema.financeCategories.name)),
    db
      .select({
        id: schema.financeTags.id,
        name: schema.financeTags.name,
        colorHex: schema.financeTags.colorHex,
      })
      .from(schema.financeTags)
      .where(eq(schema.financeTags.accountId, accountId))
      .orderBy(asc(schema.financeTags.name)),
  ]);

  return { categories, tags };
}

export async function resolveImportAssignments(
  accountId: string,
  assignments: Record<string, { categoryId?: string | null; tagIds?: string[] }> | undefined
): Promise<Map<number, ResolvedImportAssignment>> {
  const resolved = new Map<number, ResolvedImportAssignment>();
  if (!assignments) return resolved;

  const [categoryRows, tagRows] = await Promise.all([
    db.select({ id: schema.financeCategories.id }).from(schema.financeCategories).where(eq(schema.financeCategories.accountId, accountId)),
    db.select({ id: schema.financeTags.id }).from(schema.financeTags).where(eq(schema.financeTags.accountId, accountId)),
  ]);
  const categoryIds = new Set(categoryRows.map((row) => row.id));
  const tagIds = new Set(tagRows.map((row) => row.id));

  for (const [key, assignment] of Object.entries(assignments)) {
    const rowNumber = Number(key);
    if (!Number.isInteger(rowNumber) || rowNumber < 1) continue;

    const setCategory = Object.prototype.hasOwnProperty.call(assignment, "categoryId");
    const categoryId =
      setCategory && typeof assignment.categoryId === "string" && categoryIds.has(assignment.categoryId) ? assignment.categoryId : null;

    resolved.set(rowNumber, {
      setCategory,
      categoryId,
      tagIds: (assignment.tagIds ?? []).filter((tagId) => tagIds.has(tagId)),
    });
  }

  return resolved;
}
