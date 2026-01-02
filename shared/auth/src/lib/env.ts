import { validateEnv } from "@pocket-dimension/utils";
import { z } from "zod";

const schema = z.object({
  BETTER_AUTH_SECRET: z.string(),
});

export const env = validateEnv("auth", schema, Bun.env);
