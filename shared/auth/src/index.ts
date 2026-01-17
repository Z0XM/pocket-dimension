import { db } from "@pocket-dimension/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { username } from "better-auth/plugins";
import { env } from "./lib/env";

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
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
