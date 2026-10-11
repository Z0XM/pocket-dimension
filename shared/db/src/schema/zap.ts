import { index, integer, pgSchema, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import * as auth from "./auth";
import { id, timestamps } from "./common";

export const zapSchema = pgSchema("zap");

export const mediaAssetStatus = zapSchema.enum("media_asset_status", ["pending", "ready", "failed"]);
export const mediaSourceType = zapSchema.enum("media_source_type", ["upload", "youtube", "url", "other"]);
export const tagKind = zapSchema.enum("tag_kind", ["system", "custom"]);

/** Global Zap catalogue — never deleted by app logic. */
export const mediaAssets = zapSchema.table(
  "media_assets",
  {
    id,
    identityKey: text("identity_key").notNull(),
    sourceType: mediaSourceType("source_type").notNull(),
    status: mediaAssetStatus("status").default("pending").notNull(),
    storageKey: text("storage_key"),
    title: text("title").notNull(),
    artists: text("artists"),
    durationMs: integer("duration_ms"),
    codec: text("codec"),
    externalUrl: text("external_url"),
    errorMessage: text("error_message"),
    addedByUserId: uuid("added_by_user_id").references(() => auth.user.id, { onDelete: "set null" }),
    createdAt: timestamps.createdAt,
    updatedAt: timestamp("updated_at")
      .$default(() => sql`now()`)
      .$onUpdate(() => sql`now()`)
      .notNull(),
  },
  (table) => [
    uniqueIndex("media_assets_identity_key_unique").on(table.identityKey),
    index("media_assets_status_idx").on(table.status),
    index("media_assets_added_by_user_id_idx").on(table.addedByUserId),
  ]
);

export const tags = zapSchema.table(
  "tags",
  {
    id,
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    kind: tagKind("kind").notNull(),
    ownerUserId: uuid("owner_user_id").references(() => auth.user.id, { onDelete: "cascade" }),
    createdAt: timestamps.createdAt,
  },
  (table) => [
    uniqueIndex("tags_system_slug_unique")
      .on(table.slug)
      .where(sql`${table.kind} = 'system'`),
    uniqueIndex("tags_custom_owner_slug_unique")
      .on(table.ownerUserId, table.slug)
      .where(sql`${table.kind} = 'custom'`),
    index("tags_owner_user_id_idx").on(table.ownerUserId),
  ]
);

/** Per-user tags on catalogue assets — drives “Your library”. */
export const mediaAssetTags = zapSchema.table(
  "media_asset_tags",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => auth.user.id, { onDelete: "cascade" }),
    mediaAssetId: uuid("media_asset_id")
      .notNull()
      .references(() => mediaAssets.id, { onDelete: "restrict" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at")
      .$default(() => sql`now()`)
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.mediaAssetId, table.tagId] }),
    index("media_asset_tags_user_id_idx").on(table.userId),
    index("media_asset_tags_media_asset_id_idx").on(table.mediaAssetId),
    index("media_asset_tags_tag_id_idx").on(table.tagId),
    index("media_asset_tags_user_asset_idx").on(table.userId, table.mediaAssetId),
  ]
);
