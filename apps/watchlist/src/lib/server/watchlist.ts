import { db, type schema } from "@pocket-dimension/db";
import { sql } from "drizzle-orm";

export const getWatchlistForUser = async (
  user?: typeof schema.user.$inferSelect,
  options?: {
    pageIndex?: number;
    searchQuery?: string;
    sorting?: Array<{ column: string; direction: "asc" | "desc" }>;
    filters?: Array<{ column: string; values: string[] }>;
  }
) => {
  const searchQuery = options?.searchQuery;
  const sorting = options?.sorting;
  const filters = options?.filters;

  const globalAggQuery = sql`
    select
      r.watch_item_id,
      avg(case when r.infinity or r.shitty then null else r.rating end) as avg_rating,
      sum(case when r.infinity then 1 else 0 end) as infinity_counts,
      sum(case when r.shitty then 1 else 0 end) as shitty_counts
    from watchlist.watch_item_ratings r
    group by r.watch_item_id
  `;

  const myAggQuery = sql`
    select
      r.watch_item_id,
      r.rating as my_rating,
      r.infinity as my_infinity,
      r.shitty as my_shitty,
      r.progress_status as my_progress_status
    from watchlist.watch_item_ratings r
    where r.user_id = ${user?.id ?? null}::uuid
  `;

  const connectedTagsQuery = sql`
    select
      wt.watch_item_id,
      string_agg(t.name, ', ' order by t.name asc) as tags
    from watchlist.watch_item_tags wt
    left join watchlist.watch_tags t on wt.watch_tag_id = t.id
    group by wt.watch_item_id
  `;

  const withQuery = sql`
    with global_agg as (${globalAggQuery}),
    my_agg as (${myAggQuery}),
    tags as (${connectedTagsQuery})
  `;

  const languageFilterValues = filters?.find((filter) => filter.column === "language")?.values;
  const progressStatusFilterValues = filters?.find((filter) => filter.column === "my_progress_status")?.values;
  const tagsFilterValues = filters?.find((filter) => filter.column === "tags")?.values;
  const typeFilterValues = filters?.find((filter) => filter.column === "type")?.values;

  const languageFilterQuery =
    languageFilterValues && languageFilterValues.length > 0
      ? sql`l.language = any(array[${sql.join(languageFilterValues, sql`, `)}]::text[])`
      : sql`true`;
  const progressStatusFilterQuery =
    progressStatusFilterValues && progressStatusFilterValues.length > 0
      ? (() => {
          const hasUnmarked = progressStatusFilterValues.includes("Unmarked");
          const otherValues = progressStatusFilterValues.filter((v) => v !== "Unmarked");

          if (hasUnmarked && otherValues.length > 0) {
            // Both "Unmarked" and other values selected
            return sql`(mr.my_progress_status is null or mr.my_progress_status::text = any(array[${sql.join(otherValues, sql`, `)}]::text[]))`;
          } else if (hasUnmarked) {
            // Only "Unmarked" selected
            return sql`mr.my_progress_status is null`;
          } else {
            // Only other values selected
            return sql`mr.my_progress_status::text = any(array[${sql.join(otherValues, sql`, `)}]::text[])`;
          }
        })()
      : sql`true`;
  const tagsFilterQuery =
    tagsFilterValues && tagsFilterValues.length > 0
      ? sql`(${sql.join(
          tagsFilterValues.map((tag) => sql`t.tags ilike ${`%${tag}%`}`),
          sql` and `
        )})`
      : sql`true`;
  const typeFilterQuery =
    typeFilterValues && typeFilterValues.length > 0 ? sql`w.type::text = any(array[${sql.join(typeFilterValues, sql`, `)}]::text[])` : sql`true`;

  const baseQuery = sql`
    from watchlist.watch_items w
    left join watchlist.watch_languages l on l.id = w.language_id
    left join global_agg gr on gr.watch_item_id = w.id
    left join my_agg mr on mr.watch_item_id = w.id
    left join tags t on t.watch_item_id = w.id
    where ${searchQuery ? sql`w.title ilike ${`%${searchQuery}%`}` : sql`true`}
  `;

  // Build ORDER BY clause
  // Reverse the sorting array so the most re cently clicked column is primary sort
  const orderByClause =
    sorting && sorting.length > 0
      ? (() => {
          const reversedSorting = [...sorting].reverse();
          const orderByParts = reversedSorting.map((sort) => {
            const direction = sort.direction === "desc" ? sql`desc nulls last` : sql`asc nulls first`;
            switch (sort.column) {
              case "order":
                return sql`w.order ${direction}`;
              case "title":
                return sql`w.title ${direction}`;
              case "type":
                return sql`w.type ${direction}`;
              case "language":
                return sql`l.language ${direction}`;
              case "my_rating":
                return sql`
                case
                  when mr.my_infinity = true then 100
                  when mr.my_shitty = true then -100
                  else mr.my_rating
                end ${direction}
              `;
              case "avg_rating":
                return sql`
                (coalesce(gr.avg_rating, 0) +
                coalesce(gr.infinity_counts, 0) * 100 +
                coalesce(gr.shitty_counts, 0) * -100)
                ${direction}
              `;
              case "my_progress_status":
                return sql`mr.my_progress_status ${direction}`;
              default:
                return sql`w.title ${direction}`;
            }
          });
          return sql`order by ${sql.join(orderByParts, sql`, `)}`;
        })()
      : // Default sorting: title ascending
        sql`order by w.order desc nulls last`;

  const tableQuery = sql`
    ${withQuery}
    select
      w.order,
      w.title,
      w.type,
      l.language,
      t.tags,
      gr.avg_rating,
      gr.infinity_counts,
      gr.shitty_counts,
      mr.my_rating,
      mr.my_infinity,
      mr.my_shitty,
      mr.my_progress_status
    ${baseQuery}
    and ${languageFilterQuery}
    and ${progressStatusFilterQuery}
    and ${tagsFilterQuery}
    and ${typeFilterQuery}
    ${orderByClause}
    limit 25
    offset ${(options?.pageIndex ?? 0) * 25}
  `;

  const watchItems = (await db.execute(tableQuery)).rows;

  return {
    watchItems,
    withQuery,
    baseQuery,
    languageFilterQuery,
    progressStatusFilterQuery,
    tagsFilterQuery,
    typeFilterQuery,
  };
};
