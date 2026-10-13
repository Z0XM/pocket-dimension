import type { PageServerLoad } from "./$types";
import { listUserLibraryActivity } from "$lib/server/activity";
import { listPlayHistory } from "$lib/server/play-history";

export const load: PageServerLoad = async ({ locals }) => {
  const userId = locals.user!.id;
  const [playHistory, activity] = await Promise.all([listPlayHistory(userId, 50), listUserLibraryActivity(userId, 50)]);
  return { playHistory, activity };
};
