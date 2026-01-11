import { json } from "@sveltejs/kit";
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
  });

  return json({ watchItems });
};
