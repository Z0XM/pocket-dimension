import { error, json } from "@sveltejs/kit";
import { parseBeforeCursor, parseHistoryTimeRange, sinceForHistoryRange } from "$lib/history-time";
import { listPlayHistoryPage } from "$lib/server/play-history";
import type { RequestHandler } from "./$types";

const PAGE_SIZE = 40;

/** Signed-in user: paginated personal play history. */
export const GET: RequestHandler = async ({ locals, url }) => {
  if (!locals.user) throw error(401, "Sign in required");
  if (!locals.user.emailVerified) throw error(403, "Verify email first");

  const q = url.searchParams.get("q")?.trim() ?? "";
  const range = parseHistoryTimeRange(url.searchParams.get("range"));
  const since = sinceForHistoryRange(range);
  const before = parseBeforeCursor(url.searchParams.get("before"));
  const limitRaw = Number(url.searchParams.get("limit") ?? String(PAGE_SIZE));
  const limit = Number.isFinite(limitRaw) ? limitRaw : PAGE_SIZE;

  const page = await listPlayHistoryPage({
    userId: locals.user.id,
    q,
    since,
    before,
    limit,
  });

  return json({
    entries: page.entries,
    nextBefore: page.nextBefore,
    hasMore: Boolean(page.nextBefore),
  });
};
