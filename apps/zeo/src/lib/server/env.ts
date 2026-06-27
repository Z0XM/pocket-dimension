import { validateEnv } from "@pocket-dimension/utils";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(3008),
  DATABASE_URL: z.string().min(1),
  LIVEKIT_API_KEY: z.string().min(1),
  LIVEKIT_API_SECRET: z.string().min(1),
  LIVEKIT_URL: z.string().min(1).default("ws://127.0.0.1:7880"),
  PUBLIC_LIVEKIT_URL: z.string().min(1).default("ws://127.0.0.1:7880"),
});

export const env = validateEnv("zeo", envSchema, Bun.env);

export const TOKEN_TTL_SECONDS = 4 * 60 * 60;
