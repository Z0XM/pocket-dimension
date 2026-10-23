import type { PageServerLoad } from "./$types";
import { listUserLibraryActivityPage } from "$lib/server/activity";
import { parseHistoryTimeRange, sinceForHistoryRange } from "$lib/history-time";

const PAGE_SIZE = 40;

export const load: PageServerLoad = async ({ locals, url }) => {
  const q = url.searchParams.get("q")?.trim() ?? "";
  const range = parseHistoryTimeRange(url.searchParams.get("range"));
  const since = sinceForHistoryRange(range);
  const page = await listUserLibraryActivityPage({
    userId: locals.user!.id,
    q,
    since,
    before: null,
    limit: PAGE_SIZE,
  });
  return {
    entries: page.entries,
    nextBefore: page.nextBefore,
    filters: { q, range },
  };
};
