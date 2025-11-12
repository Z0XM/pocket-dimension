import { z } from "zod";
import { baseEnvSchema, validateEnv, validateEnvSafe } from "./index.js";

/**
 * Web app environment schema
 */
export const webEnvSchema = baseEnvSchema.extend({
  // API Configuration
  API_URL: z.string().url(),
  API_TIMEOUT: z.string().transform(Number).pipe(z.number().int().positive()).default("30000"),

  // Feature Flags
  ENABLE_FEATURE_X: z
    .string()
    .transform((val) => val === "true")
    .pipe(z.boolean())
    .default("false"),
  ENABLE_FEATURE_Y: z
    .string()
    .transform((val) => val === "true")
    .pipe(z.boolean())
    .default("true"),

  // Optional Analytics
  ANALYTICS_ID: z.string().optional(),

  // Optional Sentry
  SENTRY_DSN: z.string().url().optional().or(z.literal("")),
});

export type WebEnv = z.infer<typeof webEnvSchema>;

/**
 * Validate web app environment variables
 */
export function validateWebEnv(env: Record<string, string | undefined> = process.env): WebEnv {
  return validateEnv(webEnvSchema, env);
}

/**
 * Validate web app environment variables with better error messages
 */
export function validateWebEnvSafe(env: Record<string, string | undefined> = process.env): WebEnv {
  return validateEnvSafe(webEnvSchema, env);
}
