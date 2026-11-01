import { isDevModeEnabled } from "@pocket-dimension/auth";
import { isZapAdmin } from "$lib/server/admin/access";
import { countRunningImportJobs } from "$lib/server/import-jobs";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ locals }) => {
  const runningImportJobs =
    locals.user?.emailVerified ? await countRunningImportJobs(locals.user.id).catch(() => 0) : 0;
  return {
    devMode: isDevModeEnabled() && Boolean(locals.devMode),
    authBaseUrl: Bun.env.BETTER_AUTH_URL ?? Bun.env.PUBLIC_BASE_AUTH_URL ?? "",
    user: locals.user
      ? {
          id: locals.user.id,
          name: locals.user.name,
          email: locals.user.email,
          username: locals.user.username,
          emailVerified: locals.user.emailVerified,
        }
      : null,
    zapAdmin: isZapAdmin(locals),
    runningImportJobs,
  };
};
