import type { PageServerLoad } from "./$types";
import { listUserLibraryActivity } from "$lib/server/activity";
import { listQueueRuns } from "$lib/server/catalog-queue";
import { listPlayHistory } from "$lib/server/play-history";

export const load: PageServerLoad = async ({ locals }) => {
  const userId = locals.user!.id;
  const [playHistory, activity, queueRuns] = await Promise.all([
    listPlayHistory(userId, 50),
    listUserLibraryActivity(userId, 50),
    listQueueRuns(userId, 30),
  ]);
  return { playHistory, activity, queueRuns };
};
