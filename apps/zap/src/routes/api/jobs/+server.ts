import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { countRunningImportJobs, listActiveImportJobs, listFailedImportItems } from "$lib/server/import-jobs";

export const GET: RequestHandler = async ({ locals, url }) => {
  if (!locals.user) throw error(401, "Sign in required");
  if (!locals.user.emailVerified) throw error(403, "Verify email first");

  const tab = url.searchParams.get("tab")?.trim() || "active";
  try {
    if (tab === "failed") {
      const items = await listFailedImportItems(locals.user.id);
      return json({ tab, items, runningCount: await countRunningImportJobs(locals.user.id) });
    }
    const jobs = await listActiveImportJobs(locals.user.id);
    return json({ tab: "active", jobs, runningCount: await countRunningImportJobs(locals.user.id) });
  } catch (err) {
    console.warn("[zap jobs] list failed (apply migration 0062?)", err);
    return json({ tab, jobs: [], items: [], runningCount: 0 });
  }
};
