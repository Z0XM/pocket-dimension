import { isDevModeEnabled } from "@pocket-dimension/auth";
import { isZapAdmin } from "$lib/server/admin/access";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ locals }) => {
  return {
    devMode: isDevModeEnabled() && Boolean(locals.devMode),
    authBaseUrl: Bun.env.BETTER_AUTH_URL ?? Bun.env.PUBLIC_BASE_AUTH_URL ?? "",
    user: locals.user
      ? {
          id: locals.user.id,
          email: locals.user.email,
          username: locals.user.username,
          emailVerified: locals.user.emailVerified,
        }
      : null,
    zapAdmin: isZapAdmin(locals),
  };
};
