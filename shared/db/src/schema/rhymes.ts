import { relations } from "drizzle-orm";
import { index, pgSchema, text, uuid } from "drizzle-orm/pg-core";
import * as auth from "./auth";
import { actionsByUser, id, timestamps } from "./common";

export const rhymesSchema = pgSchema("rhymes");

export const rhymesContentType = rhymesSchema.enum("rhymes_content_type", ["poem", "article", "song", "diary"]);
export const rhymesPieceStatus = rhymesSchema.enum("rhymes_piece_status", ["draft", "published"]);
export const rhymesPieceVisibility = rhymesSchema.enum("rhymes_piece_visibility", ["public", "hidden"]);
export const rhymesReaderMode = rhymesSchema.enum("rhymes_reader_mode", ["continuous", "paged"]);

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
    defaultReaderMode: rhymesReaderMode("default_reader_mode").default("continuous").notNull(),
    authorId: uuid("author_id")
      .notNull()
      .references(() => auth.user.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("rhymes_pieces_author_id_idx").on(table.authorId),
    index("rhymes_pieces_status_visibility_idx").on(table.status, table.visibility),
  ]
);

export const rhymesPiecesRelations = relations(rhymesPieces, ({ one }) => ({
  author: one(auth.user, {
    fields: [rhymesPieces.authorId],
    references: [auth.user.id],
  }),
}));
