import { db, schema } from "@pocket-dimension/db";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { MAX_CUSTOM_TAG_LENGTH, slugifyTag } from "$lib/custom-tags";

export type SystemTagRow = {
  id: string;
  name: string;
  slug: string;
  /** Songs tagged with it across all users. */
  songCount: number;
  /** Users who applied it at least once. */
  userCount: number;
  /** Private custom tags (any owner) with the same slug — shown so admins notice overlaps. */
  customTwins: number;
  createdAt: string;
};

export class TagAdminError extends Error {
  constructor(
    message: string,
    readonly status: number = 400
  ) {
    super(message);
    this.name = "TagAdminError";
  }
}

export async function listSystemTagsForAdmin(): Promise<SystemTagRow[]> {
  const tags = await db.select().from(schema.tags).where(eq(schema.tags.kind, "system")).orderBy(asc(schema.tags.name));
  if (tags.length === 0) return [];

  const [usage, twins] = await Promise.all([
    db
      .select({
        tagId: schema.mediaAssetTags.tagId,
        songCount: sql<number>`count(distinct ${schema.mediaAssetTags.mediaAssetId})::int`,
        userCount: sql<number>`count(distinct ${schema.mediaAssetTags.userId})::int`,
      })
      .from(schema.mediaAssetTags)
      .where(
        inArray(
          schema.mediaAssetTags.tagId,
          tags.map((t) => t.id)
        )
      )
      .groupBy(schema.mediaAssetTags.tagId),
    db
      .select({ slug: schema.tags.slug, count: sql<number>`count(*)::int` })
      .from(schema.tags)
      .where(
        and(
          eq(schema.tags.kind, "custom"),
          inArray(
            schema.tags.slug,
            tags.map((t) => t.slug)
          )
        )
      )
      .groupBy(schema.tags.slug),
  ]);
  const usageByTag = new Map(usage.map((u) => [u.tagId, u]));
  const twinsBySlug = new Map(twins.map((t) => [t.slug, t.count]));

  return tags.map((tag) => ({
    id: tag.id,
    name: tag.name,
    slug: tag.slug,
    songCount: usageByTag.get(tag.id)?.songCount ?? 0,
    userCount: usageByTag.get(tag.id)?.userCount ?? 0,
    customTwins: twinsBySlug.get(tag.slug) ?? 0,
    createdAt: tag.createdAt.toISOString(),
  }));
}

export async function createSystemTag(rawName: string) {
  const name = rawName.trim().replace(/\s+/g, " ").slice(0, MAX_CUSTOM_TAG_LENGTH);
  const slug = slugifyTag(name);
  if (!slug) throw new TagAdminError("Tag name needs at least one letter or number.");

  const existing = await db.query.tags.findFirst({
    where: and(eq(schema.tags.kind, "system"), eq(schema.tags.slug, slug)),
  });
  if (existing) throw new TagAdminError(`System tag "${existing.name}" already exists.`, 409);

  const [inserted] = await db.insert(schema.tags).values({ name, slug, kind: "system", ownerUserId: null }).onConflictDoNothing().returning();
  if (!inserted) throw new TagAdminError("System tag already exists.", 409);
  return inserted;
}

/** Deletes a system tag; `media_asset_tags` links cascade, so it disappears from every user's songs. */
export async function deleteSystemTag(tagId: string) {
  const [deleted] = await db
    .delete(schema.tags)
    .where(and(eq(schema.tags.id, tagId), eq(schema.tags.kind, "system")))
    .returning();
  if (!deleted) throw new TagAdminError("System tag not found.", 404);
  return deleted;
}
