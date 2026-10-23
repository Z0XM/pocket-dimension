import type { PageServerLoad } from "./$types";
import { listConnectionsSummary } from "$lib/server/connections";

export const load: PageServerLoad = async ({ locals }) => {
  const userId = locals.user!.id;
  return listConnectionsSummary(userId);
};
