import { db, schema } from "@pocket-dimension/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { CatalogRow, ImportResult, RatingRow, ViewRow } from "./types";

export async function exportCatalog(): Promise<CatalogRow[]> {
  const rows = await db.execute(sql`
    select
      wi.title,
      wi.type::text as type,
      l.language,
      wi.seasons,
      wi.release_status::text as release_status,
      coalesce(
        (
          select string_agg(t.name, ', ' order by t.name asc)
          from watchlist.watch_item_tags wt
          join watchlist.watch_tags t on t.id = wt.watch_tag_id
          where wt.watch_item_id = wi.id
        ),
        ''
      ) as tags
    from watchlist.watch_items wi
    join watchlist.watch_languages l on l.id = wi.language_id
    order by wi.title asc
  `);

  return (rows.rows as CatalogRow[]).map((r) => ({
    title: r.title,
    type: r.type,
    language: r.language,
    seasons: r.seasons === null || r.seasons === undefined ? null : Number(r.seasons),
    release_status: r.release_status,
    tags: r.tags ?? "",
  }));
}

export async function exportRatings(userId: string): Promise<RatingRow[]> {
  const rows = await db.execute(sql`
    select
      wi.title,
      r.rating::text as rating,
      coalesce(r.infinity, false) as infinity,
      coalesce(r.shitty, false) as shitty,
      r.recommendation::text as recommendation,
      coalesce(r.review, '') as review,
      r.progress_status::text as progress_status,
      r.dropped_at_season,
      r.dropped_at_episode
    from watchlist.watch_item_ratings r
    join watchlist.watch_items wi on wi.id = r.watch_item_id
    where r.user_id = ${userId}::uuid
    order by wi.title asc
  `);

  return (rows.rows as any[]).map((r) => ({
    title: r.title,
    rating: r.rating,
    infinity: !!r.infinity,
    shitty: !!r.shitty,
    recommendation: r.recommendation,
    review: r.review ?? "",
    progress_status: r.progress_status,
    dropped_at_season: r.dropped_at_season === null || r.dropped_at_season === undefined ? null : Number(r.dropped_at_season),
    dropped_at_episode: r.dropped_at_episode === null || r.dropped_at_episode === undefined ? null : Number(r.dropped_at_episode),
  }));
}

export async function exportViews(userId: string): Promise<ViewRow[]> {
  const views = await db
    .select({
      name: schema.watchlistViews.name,
      filters: schema.watchlistViews.filters,
      isFavorite: schema.watchlistViews.isFavorite,
    })
    .from(schema.watchlistViews)
    .where(eq(schema.watchlistViews.userId, userId));

  return views.map((v) => ({
    name: v.name,
    filters: JSON.stringify(v.filters ?? {}),
    is_favorite: !!v.isFavorite,
  }));
}

const VALID_TYPES = new Set(["movie", "series", "shorts"]);
const VALID_RELEASE = new Set(["released", "on-going", "coming-soon"]);
const VALID_RECS = new Set(["must_watch", "go_for_it", "one_time_watch", "skip_it"]);
const VALID_PROGRESS = new Set(["watch_later", "watching", "watched", "dropped"]);

function parseBool(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  const s = String(value ?? "")
    .trim()
    .toLowerCase();
  return s === "true" || s === "1" || s === "yes";
}

function emptyToNull(value: unknown): string | null {
  const s = String(value ?? "").trim();
  return s === "" ? null : s;
}

/**
 * Import catalog rows. Creates missing languages/tags; upserts by title.
 * Only contributor/admin should call this (enforced by route).
 */
export async function importCatalog(rows: Array<Record<string, unknown>>, actorUserId: string): Promise<ImportResult> {
  const result: ImportResult = { dataset: "catalog", imported: 0, updated: 0, skipped: 0, errors: [] };
  const now = new Date();

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2; // header is row 1
    const raw = rows[i];
    try {
      const title = String(raw.title ?? "").trim();
      const type = String(raw.type ?? "")
        .trim()
        .toLowerCase();
      const languageName = String(raw.language ?? "").trim();
      if (!title) {
        result.errors.push({ row: rowNum, message: "title is required" });
        result.skipped++;
        continue;
      }
      if (!VALID_TYPES.has(type)) {
        result.errors.push({ row: rowNum, message: `invalid type: ${type}` });
        result.skipped++;
        continue;
      }
      if (!languageName) {
        result.errors.push({ row: rowNum, message: "language is required" });
        result.skipped++;
        continue;
      }

      const releaseStatusRaw = emptyToNull(raw.release_status);
      const releaseStatus = releaseStatusRaw && VALID_RELEASE.has(releaseStatusRaw) ? releaseStatusRaw : "released";
      const seasonsRaw = emptyToNull(raw.seasons);
      const seasons = seasonsRaw === null ? null : Number(seasonsRaw);
      if (seasons !== null && Number.isNaN(seasons)) {
        result.errors.push({ row: rowNum, message: "seasons must be a number" });
        result.skipped++;
        continue;
      }

      // Upsert language
      let [language] = await db.select().from(schema.watchLanguages).where(eq(schema.watchLanguages.language, languageName)).limit(1);
      if (!language) {
        [language] = await db
          .insert(schema.watchLanguages)
          .values({
            language: languageName,
            createdById: actorUserId,
            updatedById: actorUserId,
            createdAt: now,
            updatedAt: now,
          })
          .returning();
      }

      const [existing] = await db.select().from(schema.watchItems).where(eq(schema.watchItems.title, title)).limit(1);

      let itemId: string;
      if (existing) {
        await db
          .update(schema.watchItems)
          .set({
            type: type as "movie" | "series" | "shorts",
            languageId: language.id,
            seasons,
            releaseStatus: releaseStatus as "released" | "on-going" | "coming-soon",
            updatedById: actorUserId,
            updatedAt: now,
          })
          .where(eq(schema.watchItems.id, existing.id));
        itemId = existing.id;
        result.updated++;
      } else {
        const [created] = await db
          .insert(schema.watchItems)
          .values({
            title,
            type: type as "movie" | "series" | "shorts",
            languageId: language.id,
            seasons,
            releaseStatus: releaseStatus as "released" | "on-going" | "coming-soon",
            createdById: actorUserId,
            updatedById: actorUserId,
            createdAt: now,
            updatedAt: now,
          })
          .returning();
        itemId = created.id;
        result.imported++;
      }

      // Tags
      const tagNames = String(raw.tags ?? "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      if (tagNames.length > 0) {
        for (const tagName of tagNames) {
          let [tag] = await db.select().from(schema.watchTags).where(eq(schema.watchTags.name, tagName)).limit(1);
          if (!tag) {
            [tag] = await db
              .insert(schema.watchTags)
              .values({
                name: tagName,
                createdById: actorUserId,
                updatedById: actorUserId,
                createdAt: now,
                updatedAt: now,
              })
              .returning();
          }
          const [link] = await db
            .select()
            .from(schema.watchItemTags)
            .where(and(eq(schema.watchItemTags.watchItemId, itemId), eq(schema.watchItemTags.watchTagId, tag.id)))
            .limit(1);
          if (!link) {
            await db.insert(schema.watchItemTags).values({
              watchItemId: itemId,
              watchTagId: tag.id,
              createdById: actorUserId,
              updatedById: actorUserId,
              createdAt: now,
              updatedAt: now,
            });
          }
        }
      }
    } catch (error: any) {
      result.errors.push({ row: rowNum, message: error?.message || "import failed" });
      result.skipped++;
    }
  }

  return result;
}

/**
 * Import personal ratings keyed by catalog title. Does not create catalog titles.
 */
export async function importRatings(rows: Array<Record<string, unknown>>, userId: string): Promise<ImportResult> {
  const result: ImportResult = { dataset: "ratings", imported: 0, updated: 0, skipped: 0, errors: [] };
  const now = new Date();

  const titles = rows.map((r) => String(r.title ?? "").trim()).filter(Boolean);
  const items =
    titles.length === 0
      ? []
      : await db
          .select({ id: schema.watchItems.id, title: schema.watchItems.title })
          .from(schema.watchItems)
          .where(inArray(schema.watchItems.title, titles));
  const byTitle = new Map(items.map((i) => [i.title, i.id]));

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2;
    const raw = rows[i];
    try {
      const title = String(raw.title ?? "").trim();
      if (!title) {
        result.errors.push({ row: rowNum, message: "title is required" });
        result.skipped++;
        continue;
      }
      const watchItemId = byTitle.get(title);
      if (!watchItemId) {
        result.errors.push({ row: rowNum, message: `unknown title: ${title}` });
        result.skipped++;
        continue;
      }

      const recommendation = emptyToNull(raw.recommendation);
      if (recommendation && !VALID_RECS.has(recommendation)) {
        result.errors.push({ row: rowNum, message: `invalid recommendation: ${recommendation}` });
        result.skipped++;
        continue;
      }
      const progressStatus = emptyToNull(raw.progress_status) ?? "watched";
      if (!VALID_PROGRESS.has(progressStatus)) {
        result.errors.push({ row: rowNum, message: `invalid progress_status: ${progressStatus}` });
        result.skipped++;
        continue;
      }

      const ratingRaw = emptyToNull(raw.rating);
      const droppedSeason = emptyToNull(raw.dropped_at_season);
      const droppedEpisode = emptyToNull(raw.dropped_at_episode);

      const values = {
        rating: ratingRaw,
        infinity: parseBool(raw.infinity),
        shitty: parseBool(raw.shitty),
        recommendation: (recommendation as any) ?? null,
        review: String(raw.review ?? ""),
        progressStatus: progressStatus as any,
        droppedAtSeason: droppedSeason === null ? null : Number(droppedSeason),
        droppedAtEpisode: droppedEpisode === null ? null : Number(droppedEpisode),
        updatedById: userId,
        updatedAt: now,
      };

      const [existing] = await db
        .select()
        .from(schema.watchItemRatings)
        .where(and(eq(schema.watchItemRatings.watchItemId, watchItemId), eq(schema.watchItemRatings.userId, userId)))
        .limit(1);

      if (existing) {
        await db.update(schema.watchItemRatings).set(values).where(eq(schema.watchItemRatings.id, existing.id));
        result.updated++;
      } else {
        await db.insert(schema.watchItemRatings).values({
          watchItemId,
          userId,
          createdById: userId,
          createdAt: now,
          ...values,
        });
        result.imported++;
      }
    } catch (error: any) {
      result.errors.push({ row: rowNum, message: error?.message || "import failed" });
      result.skipped++;
    }
  }

  return result;
}
