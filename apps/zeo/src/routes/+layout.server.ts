import { isDevModeEnabled } from "@pocket-dimension/auth";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ locals }) => {
  return {
    devMode: isDevModeEnabled() && Boolean(locals.devMode),
    authBaseUrl: Bun.env.BETTER_AUTH_URL ?? Bun.env.PUBLIC_BASE_AUTH_URL ?? "",
    devModeUser: locals.user ? { username: locals.user.username ?? null, email: locals.user.email } : null,
    user: locals.user
      ? {
          id: locals.user.id,
          email: locals.user.email,
          username: locals.user.username,
          emailVerified: locals.user.emailVerified,
          role: locals.user.role,
        }
      : null,
  };
};
