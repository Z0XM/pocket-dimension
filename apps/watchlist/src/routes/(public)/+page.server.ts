import { db, schema } from "@pocket-dimension/db";
import { desc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => {
  const user = locals.user;

  const dbItems = alias(schema.watchItems, "items");
  const dbItemTags = alias(schema.watchItemTags, "item_tags");
  const dbWatchTags = alias(schema.watchTags, "watch_tags");
  const dbAggRatings = alias(schema.watchItemRatings, "agg_ratings");
  const dbMyRatings = alias(schema.watchItemRatings, "my_ratings");

  const tags_sub = db
    .select({
      watchItemId: dbItemTags.watchItemId,
      tags: sql<string[]>`array_agg(${dbWatchTags.name})`.as("tags"),
    })
    .from(dbItemTags)
    .leftJoin(dbWatchTags, eq(dbWatchTags.id, dbItemTags.watchTagId))
    .groupBy(dbItemTags.watchItemId)
    .as("tags_sub");

  const agg_ratings_sub = db
    .select({
      watchItemId: dbAggRatings.watchItemId,
      avgRating:
        sql<number>`avg(case when ${dbAggRatings.infinity} then 10 when ${dbAggRatings.shitty} then 0 else ${dbAggRatings.rating} end)`.as(
          "avg_ating"
        ),
      infinityCounts: sql<number>`sum(case when ${dbAggRatings.infinity} then 1 else 0 end)`.as(
        "infinity_counts"
      ),
      shittyCounts: sql<number>`sum(case when ${dbAggRatings.shitty} then 1 else 0 end)`.as(
        "shitty_counts"
      ),
    })
    .from(dbAggRatings)
    .groupBy(dbAggRatings.watchItemId)
    .as("agg_ratings_sub");

  const my_ratings_sub = db
    .select({
      watchItemId: dbMyRatings.watchItemId,
      myRating: dbMyRatings.rating,
      myInfinity: dbMyRatings.infinity,
      myShitty: dbMyRatings.shitty,
      myWatchProgress: dbMyRatings.progressStatus,
      myDroppedAtSeason: dbMyRatings.droppedAtSeason,
      myDroppedAtEpisode: dbMyRatings.droppedAtEpisode,
      myReview: dbMyRatings.review,
      myRecommendation: dbMyRatings.recommendation,
    })
    .from(dbMyRatings)
    .where(
      sql`${user?.id ?? null}::uuid is not null and ${dbMyRatings.userId} = ${user?.id ?? null}::uuid`
    )
    .as("my_ratings_sub");

  const watchItems = await db
    .select({
      id: dbItems.id,
      title: dbItems.title,
      releaseStatus: dbItems.releaseStatus,
      seasons: dbItems.seasons,
      type: dbItems.type,
      language: schema.watchLanguages.language,
      tags: tags_sub.tags,
      avgRating: agg_ratings_sub.avgRating,
      infinityCounts: agg_ratings_sub.infinityCounts,
      shittyCounts: agg_ratings_sub.shittyCounts,
      myRating: my_ratings_sub.myRating,
      myInfinity: my_ratings_sub.myInfinity,
      myShitty: my_ratings_sub.myShitty,
      myWatchProgress: my_ratings_sub.myWatchProgress,
      myDroppedAtSeason: my_ratings_sub.myDroppedAtSeason,
      myDroppedAtEpisode: my_ratings_sub.myDroppedAtEpisode,
      myReview: my_ratings_sub.myReview,
      myRecommendation: my_ratings_sub.myRecommendation,
    })
    .from(dbItems)
    .leftJoin(schema.watchLanguages, eq(dbItems.languageId, schema.watchLanguages.id))
    .leftJoin(tags_sub, eq(tags_sub.watchItemId, dbItems.id))
    .leftJoin(agg_ratings_sub, eq(agg_ratings_sub.watchItemId, dbItems.id))
    .leftJoin(my_ratings_sub, eq(my_ratings_sub.watchItemId, dbItems.id))
    .orderBy(desc(dbItems.title))
    .limit(25);

  const languages = await db
    .select({
      id: schema.watchLanguages.id,
      name: schema.watchLanguages.language,
    })
    .from(schema.watchLanguages);

  const tags = await db
    .select({
      id: schema.watchTags.id,
      name: schema.watchTags.name,
    })
    .from(schema.watchTags);

  return {
    watchItems,
    languages,
    tags,
  };
};
