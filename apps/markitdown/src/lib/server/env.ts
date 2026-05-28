import { validateEnv } from "@pocket-dimension/utils";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(3006),
  HOST: z.string().default("0.0.0.0"),
  PYTHON_PATH: z.string().default("python3"),
  PYTHON_PACKAGES_DIR: z.string().optional(),
  BODY_SIZE_LIMIT: z.coerce.number().default(52_428_800),
});

export const env = validateEnv("markitdown", envSchema, Bun.env);
