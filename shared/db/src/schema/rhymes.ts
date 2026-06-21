import { relations } from "drizzle-orm";
import { index, integer, jsonb, numeric, pgSchema, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import * as auth from "./auth";
import { actionsByUser, id, timestamps } from "./common";

export const rhymesSchema = pgSchema("rhymes");

export const rhymesContentType = rhymesSchema.enum("rhymes_content_type", ["poem", "article", "song", "diary"]);
export const rhymesPieceStatus = rhymesSchema.enum("rhymes_piece_status", ["draft", "published"]);
export const rhymesPieceVisibility = rhymesSchema.enum("rhymes_piece_visibility", ["public", "hidden"]);
export const rhymesReaderMode = rhymesSchema.enum("rhymes_reader_mode", ["continuous", "paged"]);
export const rhymesSourceMode = rhymesSchema.enum("rhymes_source_mode", ["plain", "markdown", "html"]);
export const rhymesDisplayTitleMode = rhymesSchema.enum("rhymes_display_title_mode", ["text", "art"]);
export const rhymesMembershipRole = rhymesSchema.enum("rhymes_membership_role", ["owner", "admin", "editor", "contributor", "viewer"]);
export const rhymesAssetKind = rhymesSchema.enum("rhymes_asset_kind", ["title_art"]);
export const rhymesPiecePermissionLevel = rhymesSchema.enum("rhymes_piece_permission_level", ["edit"]);

export const rhymesPieces = rhymesSchema.table(
  "pieces",
  {
    id,
    ...timestamps,
    ...actionsByUser,
    slug: text("slug").notNull().unique(),
    contentType: rhymesContentType("content_type").default("poem").notNull(),
    status: rhymesPieceStatus("status").default("draft").notNull(),
    visibility: rhymesPieceVisibility("visibility").default("hidden").notNull(),
    titleText: text("title_text").notNull(),
    bodyPlain: text("body_plain").notNull(),
    sourceMode: rhymesSourceMode("source_mode").default("plain").notNull(),
    bodyDocument: jsonb("body_document"),
    bodyRenderHtml: text("body_render_html"),
    titleRichJson: jsonb("title_rich_json"),
    displayTitleMode: rhymesDisplayTitleMode("display_title_mode").default("text").notNull(),
    titleArtAssetId: uuid("title_art_asset_id"),
    legacyMetadata: jsonb("legacy_metadata"),
    defaultReaderMode: rhymesReaderMode("default_reader_mode").default("continuous").notNull(),
    creatorRating: integer("creator_rating"),
    readerAverageRating: numeric("reader_average_rating", { precision: 4, scale: 2 }),
    readerRatingCount: integer("reader_rating_count").default(0).notNull(),
    publishedAt: timestamp("published_at"),
    authorId: uuid("author_id")
      .notNull()
      .references(() => auth.user.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("rhymes_pieces_author_id_idx").on(table.authorId),
    index("rhymes_pieces_status_visibility_idx").on(table.status, table.visibility),
  ]
);

export const rhymesAssets = rhymesSchema.table(
  "assets",
  {
    id,
    ...timestamps,
    ...actionsByUser,
    pieceId: uuid("piece_id")
      .notNull()
      .references(() => rhymesPieces.id, { onDelete: "cascade" }),
    kind: rhymesAssetKind("kind").notNull(),
    storageKey: text("storage_key").notNull(),
    mimeType: text("mime_type").notNull(),
  },
  (table) => [index("rhymes_assets_piece_id_idx").on(table.pieceId)]
);

export const rhymesPieceRatings = rhymesSchema.table(
  "piece_ratings",
  {
    id,
    ...timestamps,
    pieceId: uuid("piece_id")
      .notNull()
      .references(() => rhymesPieces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => auth.user.id, { onDelete: "cascade" }),
    rating: integer("rating").notNull(),
  },
  (table) => [
    unique("rhymes_piece_ratings_piece_user_unique").on(table.pieceId, table.userId),
    index("rhymes_piece_ratings_piece_id_idx").on(table.pieceId),
  ]
);

export const rhymesMemberships = rhymesSchema.table(
  "memberships",
  {
    id,
    ...timestamps,
    ...actionsByUser,
    userId: uuid("user_id")
      .notNull()
      .references(() => auth.user.id, { onDelete: "cascade" }),
    role: rhymesMembershipRole("role").default("viewer").notNull(),
  },
  (table) => [unique("rhymes_memberships_user_id_unique").on(table.userId)]
);

export const rhymesPiecePermissions = rhymesSchema.table(
  "piece_permissions",
  {
    id,
    ...timestamps,
    ...actionsByUser,
    pieceId: uuid("piece_id")
      .notNull()
      .references(() => rhymesPieces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => auth.user.id, { onDelete: "cascade" }),
    permissionLevel: rhymesPiecePermissionLevel("permission_level").default("edit").notNull(),
  },
  (table) => [
    unique("rhymes_piece_permissions_piece_user_unique").on(table.pieceId, table.userId),
    index("rhymes_piece_permissions_user_id_idx").on(table.userId),
  ]
);

export const rhymesPieceEvents = rhymesSchema.table(
  "piece_events",
  {
    id,
    createdAt: timestamps.createdAt,
    pieceId: uuid("piece_id")
      .notNull()
      .references(() => rhymesPieces.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id")
      .notNull()
      .references(() => auth.user.id, { onDelete: "cascade" }),
    action: text("action").notNull(),
    payloadJson: jsonb("payload_json"),
  },
  (table) => [index("rhymes_piece_events_piece_id_idx").on(table.pieceId)]
);

export const rhymesPiecesRelations = relations(rhymesPieces, ({ one, many }) => ({
  author: one(auth.user, {
    fields: [rhymesPieces.authorId],
    references: [auth.user.id],
  }),
  titleArtAsset: one(rhymesAssets, {
    fields: [rhymesPieces.titleArtAssetId],
    references: [rhymesAssets.id],
  }),
  ratings: many(rhymesPieceRatings),
  permissions: many(rhymesPiecePermissions),
  events: many(rhymesPieceEvents),
  assets: many(rhymesAssets),
}));
