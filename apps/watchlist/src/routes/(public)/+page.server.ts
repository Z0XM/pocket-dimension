import { db } from "@pocket-dimension/db";
import { sql } from "drizzle-orm";
import { getWatchlistForUser } from "$lib/server/watchlist";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, url }) => {
  try {
    const user = locals.user;
    const searchQuery = (url.searchParams.get("q") as string) ?? undefined;
    const sortBy = url.searchParams.get("sortBy") ?? undefined;
    const sortOrder = url.searchParams.get("sortOrder") ?? undefined;

    // Parse sorting parameters
    let sorting: Array<{ column: string; direction: "asc" | "desc" }> | undefined;
    if (sortBy) {
      const columns = sortBy.split(",");
      const orders = sortOrder?.split(",") ?? [];
      sorting = columns.map((col, idx) => ({
        column: col.trim(),
        direction: (orders[idx]?.trim().toLowerCase() === "desc" ? "desc" : "asc") as "asc" | "desc",
      }));
    }

    // Parse filter parameters
    const filterLanguage = url.searchParams.get("filterLanguage");
    const filterTags = url.searchParams.get("filterTags");
    const filterProgress = url.searchParams.get("filterProgress");
    const filterType = url.searchParams.get("filterType");

    const languageValues = filterLanguage
      ? filterLanguage
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean)
      : [];
    const tagsValues = filterTags
      ? filterTags
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean)
      : [];
    const progressValues = filterProgress
      ? filterProgress
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean)
      : [];
    const typeValues = filterType
      ? filterType
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean)
      : [];

    const { watchItems, withQuery, baseQuery, languageFilterQuery, progressStatusFilterQuery, tagsFilterQuery, typeFilterQuery } =
      await getWatchlistForUser(user, {
        pageIndex: 0,
        searchQuery,
        sorting,
        filters: [
          { column: "language", values: languageValues },
          { column: "my_progress_status", values: progressValues },
          { column: "tags", values: tagsValues },
          { column: "type", values: typeValues },
        ],
      });

    const languagesQuery = sql`
    ${withQuery}
    select
      distinct l.language
    ${baseQuery}
    and ${progressStatusFilterQuery}
    and ${tagsFilterQuery}
    and ${typeFilterQuery}
    order by l.language asc
  `;

    const tagsQuery = sql`
    ${withQuery}
    select
      distinct trim(string_to_table(t.tags, ',')) as tag
    ${baseQuery}
    and ${languageFilterQuery}
    and ${progressStatusFilterQuery}
    and ${typeFilterQuery}
    group by tag
    order by tag asc
  `;

    const progressQuery = sql`
    ${withQuery}
    select
      distinct mr.my_progress_status
    ${baseQuery}
    and ${languageFilterQuery}
    and ${tagsFilterQuery}
    and ${typeFilterQuery}
    order by mr.my_progress_status asc
  `;

    const typesQuery = sql`
    ${withQuery}
    select
      distinct w.type
    ${baseQuery}
    and ${languageFilterQuery}
    and ${progressStatusFilterQuery}
    and ${tagsFilterQuery}
    order by w.type asc
  `;

    const languages = (await db.execute(languagesQuery)).rows;
    const tags = (await db.execute(tagsQuery)).rows;
    const progressStatuses = (await db.execute(progressQuery)).rows;
    const types = (await db.execute(typesQuery)).rows;

    // Get ALL languages with IDs for edit mode dropdowns (not filtered)
    const allLanguagesQuery = sql`
      select id, language from watchlist.watch_languages order by language asc
    `;
    const allLanguages = (await db.execute(allLanguagesQuery)).rows as Array<{ id: string; language: string }>;

    // Get ALL watch item types for edit mode dropdowns
    const allTypesQuery = sql`
      select unnest(enum_range(null::watchlist.watch_item_type))::text as type
    `;
    const allTypesResult = (await db.execute(allTypesQuery)).rows as Array<{ type: string }>;
    const allTypes = allTypesResult.map((r) => r.type);

    return {
      watchItems,
      languages,
      tags,
      progressStatuses,
      types,
      allLanguages,
      allTypes,
      userRole: user?.role ?? "user",
    };
  } catch (error) {
    console.error(error);
    return {
      watchItems: [],
      languages: [],
      tags: [],
      progressStatuses: [],
      types: [],
      allLanguages: [],
      allTypes: [],
      userRole: "user" as const,
    };
  }
};
