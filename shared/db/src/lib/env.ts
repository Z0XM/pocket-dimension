import { validateEnv } from "@pocket-dimension/utils";
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.url(),
});

export const env = validateEnv("db", schema, Bun.env);
