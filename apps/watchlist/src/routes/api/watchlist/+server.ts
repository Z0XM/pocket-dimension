import { json } from "@sveltejs/kit";
import { getWatchlistForUser } from "$lib/server/watchlist";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ request, url, locals }) => {
  const user = locals.user;

  const pageIndex = Number(url.searchParams.get("pageIndex") ?? 0);

  const { watchItems } = await getWatchlistForUser(user, { pageIndex });

  return json({ watchItems });
};
