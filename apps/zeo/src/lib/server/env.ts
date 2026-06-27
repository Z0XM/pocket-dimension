import { validateEnv } from "@pocket-dimension/utils";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(3008),
  DATABASE_URL: z.string().min(1),
  LIVEKIT_API_KEY: z.string().min(1),
  LIVEKIT_API_SECRET: z.string().min(1),
  LIVEKIT_URL: z.string().min(1).default("ws://127.0.0.1:7880"),
  PUBLIC_LIVEKIT_URL: z.string().min(1).default("ws://127.0.0.1:7880"),
  /** External coturn host — omit when using LiveKit embedded TURN (default production path). */
  LIVEKIT_TURN_HOST: z.string().min(1).optional(),
  LIVEKIT_TURN_USERNAME: z.string().min(1).optional(),
  LIVEKIT_TURN_CREDENTIAL: z.string().min(1).optional(),
  LIVEKIT_TURN_TLS: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
});

export type ZeoEnv = z.infer<typeof envSchema>;

let _env: ZeoEnv | null = null;

function getEnv(): ZeoEnv {
  if (!_env) {
    _env = validateEnv("zeo", envSchema, Bun.env);
  }
  return _env;
}

/** Validated at first access (runtime), not at SvelteKit build time. */
export const env = new Proxy({} as ZeoEnv, {
  get(_, prop: string) {
    return getEnv()[prop as keyof ZeoEnv];
  },
});

export const TOKEN_TTL_SECONDS = 4 * 60 * 60;
