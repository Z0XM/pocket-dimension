import type { PageServerLoad } from "./$types";
import { countRunningImportJobs, listActiveImportJobs, listFailedImportItems } from "$lib/server/import-jobs";

export const load: PageServerLoad = async ({ locals, url }) => {
  const userId = locals.user!.id;
  const tab = url.searchParams.get("tab") === "failed" ? "failed" : "active";
  try {
    const [jobs, failedItems, runningCount] = await Promise.all([
      listActiveImportJobs(userId),
      listFailedImportItems(userId),
      countRunningImportJobs(userId),
    ]);
    return { tab, jobs, failedItems, runningCount };
  } catch (err) {
    console.warn("[zap jobs] page load failed (apply migration 0062?)", err);
    return { tab, jobs: [], failedItems: [], runningCount: 0 };
  }
};
