import { z } from "zod";

export const baseEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

/**
 * Validate environment variables
 * @returns Validated environment variables
 */
export function validateEnv<T extends z.ZodRawShape>(
  appEnvSchema: z.ZodObject<T>,
  env: typeof Bun.env
) {
  const schema = baseEnvSchema.extend(appEnvSchema);
  return schema.parse(env) as z.infer<typeof baseEnvSchema> & z.infer<z.ZodObject<T>>;
}
