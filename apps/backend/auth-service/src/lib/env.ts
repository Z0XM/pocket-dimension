import { validateEnv } from "@pocket-dimension/utils";
import { z } from "zod";

const schema = z.object({
  PORT: z.string(),
  BETTER_AUTH_SECRET: z.string(),
  BETTER_AUTH_URL: z.url(),
});

export const env = validateEnv("auth-service", schema, Bun.env);
