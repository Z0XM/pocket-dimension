import { db } from "@pocket-dimension/db";
import { sql } from "drizzle-orm";
import type { LeaderboardData, LeaderboardEntry, LeaderboardFilters, LeaderboardMetric } from "$lib/leaderboard";

function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  return Number(value);
}

function buildLanguageFilter(languages: string[]) {
  if (languages.length === 0) return sql`true`;
  return sql`lower(l.language) = any(array[${sql.join(
    languages.map((v) => v.toLowerCase()),
    sql`, `
  )}]::text[])`;
}

function buildTypeFilter(types: string[]) {
  if (types.length === 0) return sql`true`;
  return sql`lower(w.type::text) = any(array[${sql.join(
    types.map((v) => v.toLowerCase()),
    sql`, `
  )}]::text[])`;
}

function buildTagsFilter(tags: string[]) {
  if (tags.length === 0) return sql`true`;
  return sql`(${sql.join(
    tags.map(
      (tag) => sql`exists (
        select 1
        from watchlist.watch_item_tags wit
        join watchlist.watch_tags wt on wt.id = wit.watch_tag_id
        where wit.watch_item_id = w.id and lower(wt.name) = lower(${tag})
      )`
    ),
    sql` and `
  )})`;
}

function buildMetricFilter(metric: LeaderboardMetric) {
  if (metric === "all_rated") return sql`true`;
  return sql`r.progress_status = ${metric}::watchlist.watch_progress_status`;
}

export async function getLeaderboardFilterOptions(): Promise<LeaderboardData["filterOptions"]> {
  const [languagesResult, typesResult, tagsResult] = await Promise.all([
    db.execute(sql`
      select language from watchlist.watch_languages order by language asc
    `),
    db.execute(sql`
      select unnest(enum_range(null::watchlist.watch_item_type))::text as type
    `),
    db.execute(sql`
      select name as tag from watchlist.watch_tags order by name asc
    `),
  ]);

  return {
    languages: languagesResult.rows.map((row) => String(row.language)),
    types: typesResult.rows.map((row) => String(row.type)),
    tags: tagsResult.rows.map((row) => String(row.tag)),
  };
}

export async function getLeaderboardData(metric: LeaderboardMetric, filters: LeaderboardFilters): Promise<LeaderboardData> {
  const languageFilter = buildLanguageFilter(filters.languages);
  const typeFilter = buildTypeFilter(filters.types);
  const tagsFilter = buildTagsFilter(filters.tags);
  const metricFilter = buildMetricFilter(metric);

  const [entriesResult, filterOptions] = await Promise.all([
    db.execute(sql`
      select
        u.id as user_id,
        u.username,
        u.display_username,
        u.name,
        count(*)::int as count
      from watchlist.watch_item_ratings r
      join auth.user u on u.id = r.user_id
      join watchlist.watch_items w on w.id = r.watch_item_id
      left join watchlist.watch_languages l on l.id = w.language_id
      where u.username is not null
        and ${metricFilter}
        and ${languageFilter}
        and ${typeFilter}
        and ${tagsFilter}
      group by u.id, u.username, u.display_username, u.name
      order by count desc, u.username asc
      limit 50
    `),
    getLeaderboardFilterOptions(),
  ]);

  const entries: LeaderboardEntry[] = entriesResult.rows.map((row, index) => ({
    rank: index + 1,
    userId: String(row.user_id),
    username: String(row.username),
    displayUsername: row.display_username ? String(row.display_username) : null,
    name: String(row.name),
    count: toNumber(row.count),
  }));

  return {
    metric,
    filters,
    entries,
    filterOptions,
  };
}
