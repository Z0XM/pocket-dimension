import { z } from "zod";

export const baseEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

/**
 * Validate environment variables
 * @returns Validated environment variables
 */
export function validateEnv<T extends z.ZodRawShape>(
  source: string,
  appEnvSchema: z.ZodObject<T>,
  env: typeof Bun.env
) {
  console.log(`Validating environment variables from ${source}`);
  const schema = baseEnvSchema.extend(appEnvSchema.shape);
  return schema.parse(env);
}
