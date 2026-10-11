import { db, schema } from "@pocket-dimension/db";
import { and, asc, eq, ilike, inArray, or, sql } from "drizzle-orm";

const SYSTEM_TAG_SEEDS = [
  { name: "slow", slug: "slow" },
  { name: "ignite", slug: "ignite" },
  { name: "blast", slug: "blast" },
  { name: "love", slug: "love" },
  { name: "sad", slug: "sad" },
  { name: "happy", slug: "happy" },
  { name: "upbeat", slug: "upbeat" },
  { name: "rap", slug: "rap" },
] as const;

export async function ensureSystemTags() {
  for (const seed of SYSTEM_TAG_SEEDS) {
    const existing = await db.query.tags.findFirst({
      where: and(eq(schema.tags.kind, "system"), eq(schema.tags.slug, seed.slug)),
    });
    if (!existing) {
      await db.insert(schema.tags).values({
        name: seed.name,
        slug: seed.slug,
        kind: "system",
        ownerUserId: null,
      });
    }
  }
}

export type CatalogueScope = "all" | "yours";

export type CatalogueQuery = {
  userId: string;
  q?: string;
  scope?: CatalogueScope;
  /** Tag ids that must ALL be present (AND). */
  tagIds?: string[];
};

export async function listCatalogue(input: CatalogueQuery) {
  const scope = input.scope ?? "all";
  const q = input.q?.trim() ?? "";
  const tagIds = input.tagIds?.filter(Boolean) ?? [];

  let assetIds: string[] | null = null;

  if (scope === "yours") {
    const tagged = await db
      .selectDistinct({ mediaAssetId: schema.mediaAssetTags.mediaAssetId })
      .from(schema.mediaAssetTags)
      .where(eq(schema.mediaAssetTags.userId, input.userId));
    assetIds = tagged.map((row) => row.mediaAssetId);
    if (assetIds.length === 0) return { assets: [], tagsByAsset: new Map<string, (typeof schema.tags.$inferSelect)[]>() };
  }

  if (tagIds.length > 0) {
    const rows = await db
      .select({
        mediaAssetId: schema.mediaAssetTags.mediaAssetId,
        count: sql<number>`count(distinct ${schema.mediaAssetTags.tagId})::int`,
      })
      .from(schema.mediaAssetTags)
      .where(and(eq(schema.mediaAssetTags.userId, input.userId), inArray(schema.mediaAssetTags.tagId, tagIds)))
      .groupBy(schema.mediaAssetTags.mediaAssetId)
      .having(sql`count(distinct ${schema.mediaAssetTags.tagId}) = ${tagIds.length}`);

    const matched = new Set(rows.map((r) => r.mediaAssetId));
    if (assetIds) {
      assetIds = assetIds.filter((id) => matched.has(id));
    } else {
      assetIds = [...matched];
    }
    if (assetIds.length === 0) return { assets: [], tagsByAsset: new Map() };
  }

  const conditions = [eq(schema.mediaAssets.status, "ready")];
  if (assetIds) {
    conditions.push(inArray(schema.mediaAssets.id, assetIds));
  }
  if (q) {
    const pattern = `%${q}%`;
    conditions.push(or(ilike(schema.mediaAssets.title, pattern), ilike(schema.mediaAssets.artists, pattern))!);
  }

  const assets = await db
    .select()
    .from(schema.mediaAssets)
    .where(and(...conditions))
    .orderBy(asc(schema.mediaAssets.title));

  const tagsByAsset = new Map<string, (typeof schema.tags.$inferSelect)[]>();
  if (assets.length > 0) {
    const links = await db
      .select({
        mediaAssetId: schema.mediaAssetTags.mediaAssetId,
        tag: schema.tags,
      })
      .from(schema.mediaAssetTags)
      .innerJoin(schema.tags, eq(schema.mediaAssetTags.tagId, schema.tags.id))
      .where(
        and(
          eq(schema.mediaAssetTags.userId, input.userId),
          inArray(
            schema.mediaAssetTags.mediaAssetId,
            assets.map((a) => a.id)
          )
        )
      );

    for (const link of links) {
      const list = tagsByAsset.get(link.mediaAssetId) ?? [];
      list.push(link.tag);
      tagsByAsset.set(link.mediaAssetId, list);
    }
  }

  return { assets, tagsByAsset };
}

export async function listAvailableTags(userId: string) {
  await ensureSystemTags();
  return db
    .select()
    .from(schema.tags)
    .where(or(eq(schema.tags.kind, "system"), eq(schema.tags.ownerUserId, userId)))
    .orderBy(asc(schema.tags.kind), asc(schema.tags.name));
}

export { SYSTEM_TAG_SEEDS };
