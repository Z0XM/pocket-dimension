import { db, schema } from "@pocket-dimension/db";
import { and, asc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { evaluateTagQuery, parseTagQuery, type TagQueryNode } from "$lib/tag-query";

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

export const CATALOGUE_PAGE_SIZE = 25;

export type CatalogueOrder = "title" | "library";

export type CatalogueQuery = {
  userId: string;
  q?: string;
  scope?: CatalogueScope;
  /** Tag ids that must ALL be present (AND). Ignored when `tagQuery` is set. */
  tagIds?: string[];
  /**
   * Nested boolean tag filter, e.g. `love and (soft not upbeat)`.
   * Supports AND / OR / NOT and parentheses. Tag leaves match name or slug.
   */
  tagQuery?: string;
  /** `library` uses per-user sort keys (playlist import order). Default title. */
  order?: CatalogueOrder;
  /** 0-based page offset in items (not pages). */
  offset?: number;
  limit?: number;
};

export type CatalogueListResult = {
  assets: CatalogueAsset[];
  tagsByAsset: Map<string, CatalogueTag[]>;
  hasMore: boolean;
  nextOffset: number;
  tagQueryError?: string | null;
  tagQueryAst?: TagQueryNode | null;
};

export type CatalogueAsset = typeof schema.mediaAssets.$inferSelect;
export type CatalogueTag = typeof schema.tags.$inferSelect;

export async function listCatalogue(input: CatalogueQuery): Promise<CatalogueListResult> {
  const scope = input.scope ?? "all";
  const q = input.q?.trim() ?? "";
  const tagIds = input.tagIds?.filter(Boolean) ?? [];
  const tagQueryRaw = input.tagQuery?.trim() ?? "";
  const limit = Math.min(Math.max(input.limit ?? CATALOGUE_PAGE_SIZE, 1), 100);
  const offset = Math.max(input.offset ?? 0, 0);

  const empty: CatalogueListResult = {
    assets: [] as CatalogueAsset[],
    tagsByAsset: new Map<string, CatalogueTag[]>(),
    hasMore: false,
    nextOffset: offset,
    tagQueryError: null,
    tagQueryAst: null,
  };

  let assetIds: string[] | null = null;
  let tagQueryError: string | null = null;
  let tagQueryAst: TagQueryNode | null = null;

  if (scope === "yours") {
    const tagged = await db
      .selectDistinct({ mediaAssetId: schema.mediaAssetTags.mediaAssetId })
      .from(schema.mediaAssetTags)
      .where(eq(schema.mediaAssetTags.userId, input.userId));
    assetIds = tagged.map((row) => row.mediaAssetId);
    if (assetIds.length === 0) return empty;
  }

  if (tagQueryRaw) {
    const parsed = parseTagQuery(tagQueryRaw);
    if (!parsed.ok) {
      return { ...empty, tagQueryError: parsed.error };
    }
    tagQueryAst = parsed.ast;

    // Universe for NOT: ready assets in current scope (or all ready).
    const universeWhere = assetIds
      ? and(eq(schema.mediaAssets.status, "ready"), inArray(schema.mediaAssets.id, assetIds))
      : eq(schema.mediaAssets.status, "ready");
    const universeRows = await db.select({ id: schema.mediaAssets.id }).from(schema.mediaAssets).where(universeWhere);
    const universe = new Set(universeRows.map((r) => r.id));
    if (universe.size === 0) return { ...empty, tagQueryAst };

    const available = await listAvailableTags(input.userId);
    const tagNameToId = new Map<string, string>();
    for (const t of available) {
      tagNameToId.set(t.name.toLowerCase(), t.id);
      tagNameToId.set(t.slug.toLowerCase(), t.id);
    }

    const universeIds = [...universe];
    const links =
      universeIds.length === 0
        ? []
        : await db
            .select({
              mediaAssetId: schema.mediaAssetTags.mediaAssetId,
              tagId: schema.mediaAssetTags.tagId,
            })
            .from(schema.mediaAssetTags)
            .where(and(eq(schema.mediaAssetTags.userId, input.userId), inArray(schema.mediaAssetTags.mediaAssetId, universeIds)));

    const tagsByAssetIds = new Map<string, Set<string>>();
    for (const link of links) {
      const set = tagsByAssetIds.get(link.mediaAssetId) ?? new Set<string>();
      set.add(link.tagId);
      tagsByAssetIds.set(link.mediaAssetId, set);
    }

    const evaluated = evaluateTagQuery(parsed.ast, {
      universe,
      tagsByAsset: tagsByAssetIds,
      tagNameToId,
    });
    if (!evaluated.ok) {
      return { ...empty, tagQueryError: evaluated.error, tagQueryAst };
    }
    assetIds = [...evaluated.assetIds];
    if (assetIds.length === 0) return { ...empty, tagQueryAst };
  } else if (tagIds.length > 0) {
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
    if (assetIds.length === 0) return empty;
  }

  const conditions = [eq(schema.mediaAssets.status, "ready")];
  if (assetIds) {
    conditions.push(inArray(schema.mediaAssets.id, assetIds));
  }
  if (q) {
    const pattern = `%${q}%`;
    conditions.push(or(ilike(schema.mediaAssets.title, pattern), ilike(schema.mediaAssets.artists, pattern))!);
  }

  const useLibraryOrder = (input.order ?? "title") === "library" || scope === "yours";

  let assets: CatalogueAsset[];
  let hasMore: boolean;

  if (useLibraryOrder) {
    // Prefer durable per-user sort keys; untitled/unkeyed rows fall back after keyed ones.
    const joined = await db
      .select({
        asset: schema.mediaAssets,
        sortKey: schema.userLibraryEntries.sortKey,
      })
      .from(schema.mediaAssets)
      .leftJoin(
        schema.userLibraryEntries,
        and(eq(schema.userLibraryEntries.mediaAssetId, schema.mediaAssets.id), eq(schema.userLibraryEntries.userId, input.userId))
      )
      .where(and(...conditions))
      .orderBy(sql`${schema.userLibraryEntries.sortKey} asc nulls last`, asc(schema.mediaAssets.title), asc(schema.mediaAssets.id))
      .limit(limit + 1)
      .offset(offset);
    hasMore = joined.length > limit;
    assets = (hasMore ? joined.slice(0, limit) : joined).map((r) => r.asset);
  } else {
    const rows = await db
      .select()
      .from(schema.mediaAssets)
      .where(and(...conditions))
      .orderBy(asc(schema.mediaAssets.title), asc(schema.mediaAssets.id))
      .limit(limit + 1)
      .offset(offset);
    hasMore = rows.length > limit;
    assets = hasMore ? rows.slice(0, limit) : rows;
  }

  const tagsByAsset = new Map<string, CatalogueTag[]>();
  if (assets.length > 0) {
    // Custom tags are private: only system tags or tags owned by this user may appear.
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
          ),
          or(eq(schema.tags.kind, "system"), eq(schema.tags.ownerUserId, input.userId))
        )
      );

    for (const link of links) {
      const list = tagsByAsset.get(link.mediaAssetId) ?? [];
      list.push(link.tag);
      tagsByAsset.set(link.mediaAssetId, list);
    }
  }

  return {
    assets,
    tagsByAsset,
    hasMore,
    nextOffset: offset + assets.length,
    tagQueryError,
    tagQueryAst,
  };
}

export function serializeCatalogueAsset(asset: CatalogueAsset, tags: CatalogueTag[] | { id: string; name: string; kind: string }[]) {
  return {
    id: asset.id,
    title: asset.title,
    artists: asset.artists,
    description: asset.description,
    channelTitle: asset.channelTitle,
    channelId: asset.channelId,
    durationMs: asset.durationMs,
    sourceType: asset.sourceType,
    playable: Boolean(asset.storageKey),
    tags: tags.map((t) => ({ id: t.id, name: t.name, kind: t.kind })),
  };
}

export async function listAvailableTags(userId: string) {
  await ensureSystemTags();
  return db
    .select()
    .from(schema.tags)
    .where(or(eq(schema.tags.kind, "system"), eq(schema.tags.ownerUserId, userId)))
    .orderBy(asc(schema.tags.kind), asc(schema.tags.name));
}

export function slugifyTag(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/** Resolve selectable tags for a user (system + their custom). Invalid ids are ignored. */
export async function resolveUserTagIds(userId: string, tagIds: string[]) {
  const unique = [...new Set(tagIds.map((id) => id.trim()).filter(Boolean))];
  if (unique.length === 0) return [];
  const rows = await db
    .select()
    .from(schema.tags)
    .where(and(inArray(schema.tags.id, unique), or(eq(schema.tags.kind, "system"), eq(schema.tags.ownerUserId, userId))));
  return rows;
}

export async function ensureCustomTag(userId: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const slug = slugifyTag(trimmed);
  if (!slug) return null;

  const existing = await db.query.tags.findFirst({
    where: and(eq(schema.tags.kind, "custom"), eq(schema.tags.ownerUserId, userId), eq(schema.tags.slug, slug)),
  });
  if (existing) return existing;

  const [inserted] = await db
    .insert(schema.tags)
    .values({
      name: trimmed.slice(0, 64),
      slug,
      kind: "custom",
      ownerUserId: userId,
    })
    .returning();
  return inserted;
}

/**
 * Replace this user's tags on an asset with the given set (many tags per song).
 * Removing tags never deletes the catalogue asset / R2 object.
 */
export async function setUserAssetTags(userId: string, mediaAssetId: string, tagIds: string[]) {
  const tags = await resolveUserTagIds(userId, tagIds);
  const nextIds = new Set(tags.map((t) => t.id));

  const existing = await db
    .select()
    .from(schema.mediaAssetTags)
    .where(and(eq(schema.mediaAssetTags.userId, userId), eq(schema.mediaAssetTags.mediaAssetId, mediaAssetId)));

  const toRemove = existing.filter((row) => !nextIds.has(row.tagId));
  for (const row of toRemove) {
    await db
      .delete(schema.mediaAssetTags)
      .where(
        and(
          eq(schema.mediaAssetTags.userId, userId),
          eq(schema.mediaAssetTags.mediaAssetId, mediaAssetId),
          eq(schema.mediaAssetTags.tagId, row.tagId)
        )
      );
  }

  for (const tag of tags) {
    await db.insert(schema.mediaAssetTags).values({ userId, mediaAssetId, tagId: tag.id }).onConflictDoNothing();
  }

  return tags;
}

/** Add tags without removing existing ones (playlist import). */
export async function addUserAssetTags(userId: string, mediaAssetId: string, tagIds: string[]) {
  const tags = await resolveUserTagIds(userId, tagIds);
  for (const tag of tags) {
    await db.insert(schema.mediaAssetTags).values({ userId, mediaAssetId, tagId: tag.id }).onConflictDoNothing();
  }
  return tags;
}

export { SYSTEM_TAG_SEEDS };
