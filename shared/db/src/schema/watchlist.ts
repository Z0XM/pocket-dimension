import { relations } from "drizzle-orm";
import { boolean, integer, json, numeric, pgSchema, serial, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import * as auth from "./auth";
import { actionsByUser, id, timestamps } from "./common";

export const watchlistSchema = pgSchema("watchlist");

export const watchItemType = watchlistSchema.enum("watch_item_type", ["movie", "series", "shorts"]);
export const watchItemReleaseStatus = watchlistSchema.enum("watch_item_release_status", ["released", "on-going", "coming-soon"]);

export const watchItems = watchlistSchema.table(
  "watch_items",
  {
    id,
    ...timestamps,
    ...actionsByUser,
    title: text("title").notNull(),
    type: watchItemType("type").notNull(),
    seasons: integer("seasons"),
    languageId: uuid("language_id")
      .notNull()
      .references(() => watchLanguages.id, { onDelete: "cascade" }),
    releaseStatus: watchItemReleaseStatus("release_status").default("released"),
    order: serial("order").notNull(),
  },
  (table) => [unique("watch_items_title_unique").on(table.title)]
);

export const watchItemTags = watchlistSchema.table(
  "watch_item_tags",
  {
    id,
    ...timestamps,
    ...actionsByUser,
    watchItemId: uuid("watch_item_id")
      .notNull()
      .references(() => watchItems.id, { onDelete: "cascade" }),
    watchTagId: uuid("watch_tag_id")
      .notNull()
      .references(() => watchTags.id, { onDelete: "cascade" }),
  },
  (table) => [unique("watch_item_tags_watch_item_id_watch_tag_id_unique").on(table.watchItemId, table.watchTagId)]
);

export const watchTags = watchlistSchema.table(
  "watch_tags",
  {
    id,
    ...timestamps,
    ...actionsByUser,
    name: text("name").notNull(),
  },
  (table) => [unique("watch_tags_name_unique").on(table.name)]
);

export const watchLanguages = watchlistSchema.table(
  "watch_languages",
  {
    id,
    ...timestamps,
    ...actionsByUser,
    language: text("language").notNull(),
  },
  (table) => [unique("watch_languages_language_unique").on(table.language)]
);

export const watchRecommendations = watchlistSchema.enum("watch_recommendations", ["must_watch", "go_for_it", "one_time_watch", "skip_it"]);

export const watchProgressStatus = watchlistSchema.enum("watch_progress_status", ["watch_later", "watching", "watched", "dropped"]);

export const watchItemRatings = watchlistSchema.table(
  "watch_item_ratings",
  {
    id,
    ...timestamps,
    ...actionsByUser,
    watchItemId: uuid("watch_item_id")
      .notNull()
      .references(() => watchItems.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => auth.user.id, { onDelete: "cascade" }),
    rating: numeric("rating"),
    infinity: boolean("infinity").default(false),
    shitty: boolean("shitty").default(false),
    recommendation: watchRecommendations("recommendation"),
    review: text("review").default(""),
    progressStatus: watchProgressStatus("progress_status").default("watched"),
    droppedAtSeason: integer("dropped_at_season"),
    droppedAtEpisode: integer("dropped_at_episode"),
  },
  (table) => [unique("watch_item_ratings_watch_item_id_user_id_unique").on(table.watchItemId, table.userId)]
);

export const watchlistViews = watchlistSchema.table(
  "watchlist_views",
  {
    id,
    ...timestamps,
    ...actionsByUser,
    userId: uuid("user_id")
      .notNull()
      .references(() => auth.user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    filters: json("filters").notNull().default({}),
    isFavorite: boolean("is_favorite").notNull().default(false),
    favoriteDate: timestamp("favorite_date"),
  },
  (table) => [unique("watchlist_views_user_id_name_unique").on(table.userId, table.name)]
);

export const watchItemRelations = relations(watchItems, ({ many, one }) => ({
  tags: many(watchItemTags),
  language: one(watchLanguages, {
    fields: [watchItems.languageId],
    references: [watchLanguages.id],
  }),
  ratings: many(watchItemRatings),
  createdBy: one(auth.user, {
    fields: [watchItems.createdById],
    references: [auth.user.id],
  }),
  updatedBy: one(auth.user, {
    fields: [watchItems.updatedById],
    references: [auth.user.id],
  }),
}));

export const watchItemTagRelations = relations(watchItemTags, ({ one }) => ({
  watchItem: one(watchItems, {
    fields: [watchItemTags.watchItemId],
    references: [watchItems.id],
  }),
  watchTag: one(watchTags, {
    fields: [watchItemTags.watchTagId],
    references: [watchTags.id],
  }),
  createdBy: one(auth.user, {
    fields: [watchItemTags.createdById],
    references: [auth.user.id],
  }),
  updatedBy: one(auth.user, {
    fields: [watchItemTags.updatedById],
    references: [auth.user.id],
  }),
}));

export const watchItemRatingRelations = relations(watchItemRatings, ({ one }) => ({
  watchItem: one(watchItems, {
    fields: [watchItemRatings.watchItemId],
    references: [watchItems.id],
  }),
  user: one(auth.user, {
    fields: [watchItemRatings.userId],
    references: [auth.user.id],
  }),
  createdBy: one(auth.user, {
    fields: [watchItemRatings.createdById],
    references: [auth.user.id],
  }),
  updatedBy: one(auth.user, {
    fields: [watchItemRatings.updatedById],
    references: [auth.user.id],
  }),
}));

export const watchTagRelations = relations(watchTags, ({ many, one }) => ({
  watchItemTags: many(watchItemTags),
  createdBy: one(auth.user, {
    fields: [watchTags.createdById],
    references: [auth.user.id],
  }),
  updatedBy: one(auth.user, {
    fields: [watchTags.updatedById],
    references: [auth.user.id],
  }),
}));

export const watchLanguageRelations = relations(watchLanguages, ({ many, one }) => ({
  watchItems: many(watchItems),
  createdBy: one(auth.user, {
    fields: [watchLanguages.createdById],
    references: [auth.user.id],
  }),
  updatedBy: one(auth.user, {
    fields: [watchLanguages.updatedById],
    references: [auth.user.id],
  }),
}));
