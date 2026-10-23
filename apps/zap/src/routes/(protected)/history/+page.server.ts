import type { PageServerLoad } from "./$types";
import { listQueueRuns } from "$lib/server/catalog-queue";

export const load: PageServerLoad = async ({ locals }) => {
  const queueRuns = await listQueueRuns(locals.user!.id, 30);
  return { queueRuns };
};
