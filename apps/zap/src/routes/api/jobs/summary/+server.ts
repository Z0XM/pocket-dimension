import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { countRunningImportJobs } from "$lib/server/import-jobs";

export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.user) throw error(401, "Sign in required");
  const runningCount = await countRunningImportJobs(locals.user.id);
  return json({ runningCount });
};
