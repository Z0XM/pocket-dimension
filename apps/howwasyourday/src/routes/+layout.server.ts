import { isDevModeEnabled } from "@pocket-dimension/auth";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ locals }) => {
  const authBaseUrl = Bun.env.BETTER_AUTH_URL ?? Bun.env.PUBLIC_BASE_AUTH_URL ?? "";
  return {
    devMode: isDevModeEnabled() && Boolean(locals.devMode),
    authBaseUrl,
    devModeUser: locals.user
      ? {
          username: locals.user.username ?? null,
          email: locals.user.email,
        }
      : null,
  };
};
