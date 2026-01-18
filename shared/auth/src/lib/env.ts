import { validateEnv } from "@pocket-dimension/utils";
import { z } from "zod";

const schema = z.object({
  BETTER_AUTH_SECRET: z.string(),
  BETTER_AUTH_URL: z.url(),
  BETTER_AUTH_PATH: z.string(),
  BETTER_AUTH_TRUSTED_ORIGINS: z.string(),
  BETTER_AUTH_COOKIE_DOMAIN: z.string(),
  RESEND_API_KEY: z.string(),
  RESEND_FROM_EMAIL: z.string().default("noreply@example.com"),
});

export const env = validateEnv("auth", schema, Bun.env);
