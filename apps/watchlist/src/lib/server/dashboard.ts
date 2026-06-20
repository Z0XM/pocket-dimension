import { db } from "@pocket-dimension/db";
import { sql } from "drizzle-orm";

export type DashboardScope = "catalog" | "personal";

export type DashboardData = {
  scope: DashboardScope;
  kpis: {
    totalTitles: number;
    movies: number;
    series: number;
    shorts: number;
    languages: number;
    tags: number;
    avgRating: number | null;
    totalRatings: number;
    watched?: number;
    watchLater?: number;
    watching?: number;
    dropped?: number;
    unmarked?: number;
    myAvgRating?: number | null;
    myInfinity?: number;
    myShitty?: number;
  };
  typeBreakdown: Array<{ label: string; count: number }>;
  languageBreakdown: Array<{ label: string; count: number }>;
  topTags: Array<{ label: string; count: number }>;
  progressBreakdown: Array<{ label: string; count: number }>;
  progressByType: Array<{ type: string; status: string; count: number }>;
  ratingHistogram: Array<{ bucket: number; count: number }>;
  avgRatingByType: Array<{ label: string; avgRating: number | null }>;
  avgRatingByLanguage: Array<{ label: string; avgRating: number | null }>;
};

const PROGRESS_LABELS: Record<string, string> = {
  watch_later: "Watch Later",
  watching: "Watching",
  watched: "Watched",
  dropped: "Dropped",
  unmarked: "Unmarked",
};

const TYPE_LABELS: Record<string, string> = {
  movie: "Movie",
  series: "Series",
  shorts: "Shorts",
};

function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  return Number(value);
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  return Number(value);
}

function formatLabel(value: string, map: Record<string, string>): string {
  return map[value] ?? value;
}

export async function getDashboardData(userId: string | undefined, scope: DashboardScope): Promise<DashboardData> {
  const effectiveScope: DashboardScope = scope === "personal" && userId ? "personal" : "catalog";

  const catalogKpisQuery = sql`
    select
      (select count(*)::int from watchlist.watch_items) as total_titles,
      (select count(*)::int from watchlist.watch_items where type = 'movie') as movies,
      (select count(*)::int from watchlist.watch_items where type = 'series') as series,
      (select count(*)::int from watchlist.watch_items where type = 'shorts') as shorts,
      (select count(*)::int from watchlist.watch_languages) as languages,
      (select count(*)::int from watchlist.watch_tags) as tags,
      (
        select round(avg(rating::numeric)::numeric, 2)
        from watchlist.watch_item_ratings
        where not infinity and not shitty and rating is not null
      ) as avg_rating,
      (select count(*)::int from watchlist.watch_item_ratings) as total_ratings
  `;

  const personalKpisQuery = userId
    ? sql`
        select
          count(*) filter (where progress_status = 'watched')::int as watched,
          count(*) filter (where progress_status = 'watch_later')::int as watch_later,
          count(*) filter (where progress_status = 'watching')::int as watching,
          count(*) filter (where progress_status = 'dropped')::int as dropped,
          count(*) filter (where infinity)::int as my_infinity,
          count(*) filter (where shitty)::int as my_shitty,
          round(avg(case when not infinity and not shitty then rating::numeric else null end)::numeric, 2) as my_avg_rating
        from watchlist.watch_item_ratings
        where user_id = ${userId}::uuid
      `
    : null;

  const unmarkedQuery =
    userId && effectiveScope === "personal"
      ? sql`
          select count(*)::int as unmarked
          from watchlist.watch_items w
          where not exists (
            select 1
            from watchlist.watch_item_ratings r
            where r.watch_item_id = w.id and r.user_id = ${userId}::uuid
          )
        `
      : null;

  const typeBreakdownQuery = sql`
    select type::text as label, count(*)::int as count
    from watchlist.watch_items
    group by type
    order by count desc, type asc
  `;

  const languageBreakdownQuery = sql`
    select l.language as label, count(*)::int as count
    from watchlist.watch_items w
    join watchlist.watch_languages l on l.id = w.language_id
    group by l.language
    order by count desc, l.language asc
  `;

  const topTagsQuery = sql`
    select t.name as label, count(*)::int as count
    from watchlist.watch_item_tags wit
    join watchlist.watch_tags t on t.id = wit.watch_tag_id
    group by t.name
    order by count desc, t.name asc
    limit 15
  `;

  const progressBreakdownQuery =
    effectiveScope === "personal" && userId
      ? sql`
          select progress_status::text as label, count(*)::int as count
          from watchlist.watch_item_ratings
          where user_id = ${userId}::uuid
          group by progress_status
          order by count desc
        `
      : sql`
          select progress_status::text as label, count(*)::int as count
          from watchlist.watch_item_ratings
          group by progress_status
          order by count desc
        `;

  const progressByTypeQuery =
    effectiveScope === "personal" && userId
      ? sql`
          select
            w.type::text as type,
            coalesce(r.progress_status::text, 'unmarked') as status,
            count(*)::int as count
          from watchlist.watch_items w
          left join watchlist.watch_item_ratings r
            on r.watch_item_id = w.id and r.user_id = ${userId}::uuid
          group by w.type, coalesce(r.progress_status::text, 'unmarked')
          order by w.type asc, status asc
        `
      : sql`
          select
            w.type::text as type,
            r.progress_status::text as status,
            count(*)::int as count
          from watchlist.watch_item_ratings r
          join watchlist.watch_items w on w.id = r.watch_item_id
          group by w.type, r.progress_status
          order by w.type asc, status asc
        `;

  const ratingHistogramQuery =
    effectiveScope === "personal" && userId
      ? sql`
          select
            (floor(rating::numeric * 2) / 2)::numeric as bucket,
            count(*)::int as count
          from watchlist.watch_item_ratings
          where user_id = ${userId}::uuid
            and not infinity
            and not shitty
            and rating is not null
          group by bucket
          order by bucket asc
        `
      : sql`
          select
            (floor(rating::numeric * 2) / 2)::numeric as bucket,
            count(*)::int as count
          from watchlist.watch_item_ratings
          where not infinity
            and not shitty
            and rating is not null
          group by bucket
          order by bucket asc
        `;

  const avgRatingByTypeQuery =
    effectiveScope === "personal" && userId
      ? sql`
          select
            w.type::text as label,
            round(avg(r.rating::numeric)::numeric, 2) as avg_rating
          from watchlist.watch_item_ratings r
          join watchlist.watch_items w on w.id = r.watch_item_id
          where r.user_id = ${userId}::uuid
            and not r.infinity
            and not r.shitty
            and r.rating is not null
          group by w.type
          order by avg_rating desc nulls last, w.type asc
        `
      : sql`
          select
            w.type::text as label,
            round(avg(r.rating::numeric)::numeric, 2) as avg_rating
          from watchlist.watch_item_ratings r
          join watchlist.watch_items w on w.id = r.watch_item_id
          where not r.infinity
            and not r.shitty
            and r.rating is not null
          group by w.type
          order by avg_rating desc nulls last, w.type asc
        `;

  const avgRatingByLanguageQuery =
    effectiveScope === "personal" && userId
      ? sql`
          select
            l.language as label,
            round(avg(r.rating::numeric)::numeric, 2) as avg_rating
          from watchlist.watch_item_ratings r
          join watchlist.watch_items w on w.id = r.watch_item_id
          join watchlist.watch_languages l on l.id = w.language_id
          where r.user_id = ${userId}::uuid
            and not r.infinity
            and not r.shitty
            and r.rating is not null
          group by l.language
          order by avg_rating desc nulls last, l.language asc
        `
      : sql`
          select
            l.language as label,
            round(avg(r.rating::numeric)::numeric, 2) as avg_rating
          from watchlist.watch_item_ratings r
          join watchlist.watch_items w on w.id = r.watch_item_id
          join watchlist.watch_languages l on l.id = w.language_id
          where not r.infinity
            and not r.shitty
            and r.rating is not null
          group by l.language
          order by avg_rating desc nulls last, l.language asc
        `;

  const [
    catalogKpisResult,
    personalKpisResult,
    unmarkedResult,
    typeBreakdownResult,
    languageBreakdownResult,
    topTagsResult,
    progressBreakdownResult,
    progressByTypeResult,
    ratingHistogramResult,
    avgRatingByTypeResult,
    avgRatingByLanguageResult,
  ] = await Promise.all([
    db.execute(catalogKpisQuery),
    personalKpisQuery ? db.execute(personalKpisQuery) : Promise.resolve({ rows: [] }),
    unmarkedQuery ? db.execute(unmarkedQuery) : Promise.resolve({ rows: [] }),
    db.execute(typeBreakdownQuery),
    db.execute(languageBreakdownQuery),
    db.execute(topTagsQuery),
    db.execute(progressBreakdownQuery),
    db.execute(progressByTypeQuery),
    db.execute(ratingHistogramQuery),
    db.execute(avgRatingByTypeQuery),
    db.execute(avgRatingByLanguageQuery),
  ]);

  const catalogKpis = catalogKpisResult.rows[0] ?? {};
  const personalKpis = personalKpisResult.rows[0] ?? {};
  const unmarked = unmarkedResult.rows[0] ?? {};

  const progressBreakdown = progressBreakdownResult.rows.map((row) => ({
    label: formatLabel(String(row.label), PROGRESS_LABELS),
    count: toNumber(row.count),
  }));

  if (effectiveScope === "personal" && userId) {
    const unmarkedCount = toNumber(unmarked.unmarked);
    if (unmarkedCount > 0) {
      progressBreakdown.push({ label: PROGRESS_LABELS.unmarked, count: unmarkedCount });
    }
  }

  return {
    scope: effectiveScope,
    kpis: {
      totalTitles: toNumber(catalogKpis.total_titles),
      movies: toNumber(catalogKpis.movies),
      series: toNumber(catalogKpis.series),
      shorts: toNumber(catalogKpis.shorts),
      languages: toNumber(catalogKpis.languages),
      tags: toNumber(catalogKpis.tags),
      avgRating: toNullableNumber(catalogKpis.avg_rating),
      totalRatings: toNumber(catalogKpis.total_ratings),
      ...(effectiveScope === "personal" && userId
        ? {
            watched: toNumber(personalKpis.watched),
            watchLater: toNumber(personalKpis.watch_later),
            watching: toNumber(personalKpis.watching),
            dropped: toNumber(personalKpis.dropped),
            unmarked: toNumber(unmarked.unmarked),
            myAvgRating: toNullableNumber(personalKpis.my_avg_rating),
            myInfinity: toNumber(personalKpis.my_infinity),
            myShitty: toNumber(personalKpis.my_shitty),
          }
        : {}),
    },
    typeBreakdown: typeBreakdownResult.rows.map((row) => ({
      label: formatLabel(String(row.label), TYPE_LABELS),
      count: toNumber(row.count),
    })),
    languageBreakdown: languageBreakdownResult.rows.map((row) => ({
      label: String(row.label),
      count: toNumber(row.count),
    })),
    topTags: topTagsResult.rows.map((row) => ({
      label: String(row.label),
      count: toNumber(row.count),
    })),
    progressBreakdown,
    progressByType: progressByTypeResult.rows.map((row) => ({
      type: formatLabel(String(row.type), TYPE_LABELS),
      status: formatLabel(String(row.status), PROGRESS_LABELS),
      count: toNumber(row.count),
    })),
    ratingHistogram: ratingHistogramResult.rows.map((row) => ({
      bucket: toNumber(row.bucket),
      count: toNumber(row.count),
    })),
    avgRatingByType: avgRatingByTypeResult.rows.map((row) => ({
      label: formatLabel(String(row.label), TYPE_LABELS),
      avgRating: toNullableNumber(row.avg_rating),
    })),
    avgRatingByLanguage: avgRatingByLanguageResult.rows.map((row) => ({
      label: String(row.label),
      avgRating: toNullableNumber(row.avg_rating),
    })),
  };
}
