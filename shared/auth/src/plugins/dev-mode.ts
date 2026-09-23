import { createAuthEndpoint, APIError } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import * as z from "zod";
import { assertDevModeEnabled, findAllowedAccount, isDevModeEnabled, loadDevModeConfig, toPublicAccounts } from "../lib/dev-mode";

function isTrustedRedirect(redirectUrl: string, trustedOrigins: string[]): boolean {
  let parsed: URL;
  try {
    parsed = new URL(redirectUrl);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return false;
  }
  const origin = parsed.origin;
  return trustedOrigins.some((trusted) => trusted === origin || trusted === "*");
}

/**
 * Dev Mode Better Auth plugin.
 * Endpoints refuse to run unless DEV_MODE=true AND NODE_ENV=development.
 * Passwordless: creates a real session for an allowlisted username.
 */
export function devMode() {
  return {
    id: "dev-mode",
    endpoints: {
      /**
       * GET /dev/sign-in?account=<username>&redirect=<absolute-app-url>
       * Creates a session for the allowlisted account and redirects with Set-Cookie.
       */
      devSignIn: createAuthEndpoint(
        "/dev/sign-in",
        {
          method: "GET",
          query: z.object({
            account: z.string().min(1).optional(),
            redirect: z.string().url(),
          }),
          metadata: {
            openapi: {
              description: "Dev Mode only: create a session for an allowlisted account and redirect",
            },
          },
        },
        async (ctx) => {
          if (!isDevModeEnabled()) {
            throw new APIError("NOT_FOUND", { message: "Not found" });
          }
          assertDevModeEnabled();

          const config = await loadDevModeConfig();
          if (!config) {
            throw new APIError("SERVICE_UNAVAILABLE", {
              message: "Dev Mode config missing. Copy shared/auth/devMode.config.example.ts to shared/auth/devMode.config.ts",
            });
          }

          const username = (ctx.query.account?.trim() || config.defaultAccount).toLowerCase();
          const allowed = findAllowedAccount(config, username);
          if (!allowed) {
            throw new APIError("FORBIDDEN", { message: `Account "${username}" is not in the Dev Mode allowlist` });
          }

          const trustedOrigins = (ctx.context.options.trustedOrigins ?? []) as string[];
          if (!isTrustedRedirect(ctx.query.redirect, trustedOrigins)) {
            throw new APIError("BAD_REQUEST", {
              message: "redirect must be an absolute URL listed in BETTER_AUTH_TRUSTED_ORIGINS",
            });
          }

          const user = await ctx.context.adapter.findOne<{
            id: string;
            email: string;
            emailVerified: boolean;
            name: string;
            username?: string | null;
            createdAt: Date;
            updatedAt: Date;
          }>({
            model: "user",
            where: [{ field: "username", value: allowed.username.toLowerCase() }],
          });

          if (!user) {
            throw new APIError("NOT_FOUND", {
              message: `No user with username "${allowed.username}". Create the account before using Dev Mode.`,
            });
          }

          const session = await ctx.context.internalAdapter.createSession(user.id);
          if (!session) {
            throw new APIError("INTERNAL_SERVER_ERROR", { message: "Could not create Dev Mode session" });
          }

          await setSessionCookie(ctx, { session, user });

          throw ctx.redirect(ctx.query.redirect);
        }
      ),

      /**
       * GET /dev/accounts — public allowlist (no secrets) for the notch switcher.
       */
      devAccounts: createAuthEndpoint(
        "/dev/accounts",
        {
          method: "GET",
          metadata: {
            openapi: {
              description: "Dev Mode only: list allowlisted accounts for the account switcher",
            },
          },
        },
        async () => {
          if (!isDevModeEnabled()) {
            throw new APIError("NOT_FOUND", { message: "Not found" });
          }
          assertDevModeEnabled();

          const config = await loadDevModeConfig();
          if (!config) {
            throw new APIError("SERVICE_UNAVAILABLE", {
              message: "Dev Mode config missing. Copy shared/auth/devMode.config.example.ts to shared/auth/devMode.config.ts",
            });
          }

          return {
            enabled: true,
            defaultAccount: config.defaultAccount,
            accounts: toPublicAccounts(config),
          };
        }
      ),
    },
  } as const;
}
