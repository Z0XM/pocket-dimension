import { validateEnv } from "@pocket-dimension/utils";
import { z } from "zod";

const schema = z.object({
  BETTER_AUTH_SECRET: z.string(),
  BETTER_AUTH_URL: z.url(),
  BETTER_AUTH_TRUSTED_ORIGINS: z.string(),
  BETTER_AUTH_COOKIE_DOMAIN: z.string(),
});

export const env = validateEnv("auth", schema, Bun.env);
