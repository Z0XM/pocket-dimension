import { db, schema } from "@pocket-dimension/db";
import { eq, inArray, sql } from "drizzle-orm";
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

    // Fetch user rating preferences if user is logged in
    let preferredUsers: Array<{ id: string; username: string }> = [];
    if (user) {
      try {
        const preferences = await db
          .select({
            preferredUserId: schema.userRatingPreferences.preferredUserId,
          })
          .from(schema.userRatingPreferences)
          .where(eq(schema.userRatingPreferences.userId, user.id));

        const preferredUserIds = preferences.map((p) => p.preferredUserId);

        if (preferredUserIds.length > 0) {
          const users = await db
            .select({
              id: schema.user.id,
              username: schema.user.username,
            })
            .from(schema.user)
            .where(inArray(schema.user.id, preferredUserIds));

          preferredUsers = users
            .filter((u): u is { id: string; username: string } => u.username !== null && u.id !== user.id)
            .map((u) => ({ id: u.id, username: u.username }));
        }
      } catch (error) {
        console.error("Error fetching user rating preferences:", error);
        // Continue without preferred users if there's an error
      }
    }

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
        preferredUsers,
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

    const allTagsQuery = sql`
      select name as tag from watchlist.watch_tags order by name asc
    `;
    const allTags = (await db.execute(allTagsQuery)).rows as Array<{ tag: string }>;

    const allTypesQuery = sql`
      select unnest(enum_range(null::watchlist.watch_item_type))::text as type
    `;
    const allTypes = (await db.execute(allTypesQuery)).rows as Array<{ type: string }>;

    return {
      watchItems,
      languages,
      tags,
      progressStatuses,
      types,
      allLanguages,
      allTags,
      allTypes,
      userRole: user?.role,
      preferredUsers,
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
      allTags: [],
      allTypes: [],
      userRole: undefined,
      preferredUsers: [],
    };
  }
};
