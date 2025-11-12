import { z } from "zod";
import { baseEnvSchema, validateEnv, validateEnvSafe } from "./index.js";

/**
 * Backend app environment schema
 */
export const backendEnvSchema = baseEnvSchema.extend({
  // Database
  DATABASE_URL: z.string().url(),
  DATABASE_POOL_MIN: z.string().transform(Number).pipe(z.number().int().positive()).default("2"),
  DATABASE_POOL_MAX: z.string().transform(Number).pipe(z.number().int().positive()).default("10"),

  // Optional Redis
  REDIS_URL: z.string().url().optional().or(z.literal("")),

  // JWT Secrets
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_EXPIRES_IN: z.string().default("7d"),

  // CORS
  CORS_ORIGIN: z.string().default("http://localhost:3000"),

  // Rate Limiting
  RATE_LIMIT_MAX: z.string().transform(Number).pipe(z.number().int().positive()).default("100"),
  RATE_LIMIT_WINDOW_MS: z
    .string()
    .transform(Number)
    .pipe(z.number().int().positive())
    .default("60000"),

  // Logging
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  // Optional External APIs
  EXTERNAL_API_KEY: z.string().optional(),
  EXTERNAL_API_URL: z.string().url().optional().or(z.literal("")),
});

export type BackendEnv = z.infer<typeof backendEnvSchema>;

/**
 * Validate backend app environment variables
 */
export function validateBackendEnv(
  env: Record<string, string | undefined> = process.env
): BackendEnv {
  return validateEnv(backendEnvSchema, env);
}

/**
 * Validate backend app environment variables with better error messages
 */
export function validateBackendEnvSafe(
  env: Record<string, string | undefined> = process.env
): BackendEnv {
  return validateEnvSafe(backendEnvSchema, env);
}
