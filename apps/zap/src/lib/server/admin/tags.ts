import { db, schema } from "@pocket-dimension/db";
import { and, asc, eq, sql } from "drizzle-orm";
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
  const rows = await db
    .select({
      tag: schema.tags,
      songCount: sql<number>`(select count(distinct mat.media_asset_id)::int from ${schema.mediaAssetTags} mat where mat.tag_id = ${schema.tags.id})`,
      userCount: sql<number>`(select count(distinct mat.user_id)::int from ${schema.mediaAssetTags} mat where mat.tag_id = ${schema.tags.id})`,
      customTwins: sql<number>`(select count(*)::int from ${schema.tags} ct where ct.kind = 'custom' and ct.slug = ${schema.tags.slug})`,
    })
    .from(schema.tags)
    .where(eq(schema.tags.kind, "system"))
    .orderBy(asc(schema.tags.name));
  return rows.map(({ tag, songCount, userCount, customTwins }) => ({
    id: tag.id,
    name: tag.name,
    slug: tag.slug,
    songCount: songCount ?? 0,
    userCount: userCount ?? 0,
    customTwins: customTwins ?? 0,
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
