import { z } from "zod";

export const baseEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

/**
 * Validate environment variables
 * @returns Validated environment variables
 */
export function validateEnv<T extends z.ZodRawShape>(appEnvSchema: z.ZodObject<T>) {
  const schema = baseEnvSchema.extend(appEnvSchema);
  return schema.parse(Bun.env) as z.infer<typeof baseEnvSchema> & z.infer<z.ZodObject<T>>;
}
