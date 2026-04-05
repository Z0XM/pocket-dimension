import { db } from "@pocket-dimension/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { username } from "better-auth/plugins";
import { sendResetPasswordEmail, sendVerificationEmail } from "./lib/emails";
import { env } from "./lib/env";

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  basePath: env.BETTER_AUTH_PATH,
  trustedOrigins: env.BETTER_AUTH_TRUSTED_ORIGINS.split(",").map((origin) => origin.trim()),
  user: {
    additionalFields: {
      role: {
        type: ["user", "contributor", "admin"],
        required: true,
        defaultValue: "user",
        input: false,
        returned: true,
        nullable: false,
        fieldName: "role",
      },
    },
  },
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      void sendResetPasswordEmail({
        email: user.email,
        name: user.name || user.email.split("@")[0],
        url,
      });
    },
    resetPasswordTokenExpiresIn: 60 * 60, // 1 hour
  },
  /**
   * Sliding session: each successful /get-session after `updateAge` extends `expiresIn`
   * from "now" (see better-auth session route). This is cookie-based refresh — no
   * separate refresh token. Pair with client `sessionOptions.refetchInterval` for
   * background keep-alive while the tab is open.
   */
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days — must hit get-session before absolute expiry
    updateAge: 60 * 60 * 24, // extend session at most once per day of activity
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      // Log the URL to debug callbackURL issues
      console.log(`[emailVerification] Sending verification email for ${user.email}`, {
        url,
        hasCallbackURL: url.includes("callbackURL"),
      });

      void sendVerificationEmail({
        email: user.email,
        name: user.name || user.email.split("@")[0],
        url,
      });
    },
    sendOnSignUp: true,
    expiresIn: 60 * 60, // 1 hour
    autoSignInAfterVerification: true,
  },
  advanced: {
    database: {
      generateId: false,
    },
    cookiePrefix: "better-auth",
    crossSubDomainCookies: {
      enabled: true,
      domain: env.BETTER_AUTH_COOKIE_DOMAIN,
    },
    defaultCookieAttributes: {
      secure: true,
      httpOnly: true,
      sameSite: "none",
    },
    useSecureCookies: true,
  },
  plugins: [
    username({
      minUsernameLength: 3,
      maxUsernameLength: 20,
      usernameValidator: (username) => {
        return /^[a-zA-Z0-9]+$/.test(username);
      },
      usernameNormalization: (username) => {
        return username.toLowerCase();
      },
    }),
  ],
});
