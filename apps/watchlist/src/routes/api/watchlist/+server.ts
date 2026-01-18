import { db, schema } from "@pocket-dimension/db";
import { json } from "@sveltejs/kit";
import { eq, inArray } from "drizzle-orm";
import { getWatchlistForUser } from "$lib/server/watchlist";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ url, locals }) => {
  const user = locals.user;

  const searchQuery = (url.searchParams.get("q") as string) ?? undefined;
  const pageIndex = Number(url.searchParams.get("pageIndex") ?? 0);
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

  const { watchItems } = await getWatchlistForUser(user, {
    pageIndex,
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

  return json({ watchItems });
};
