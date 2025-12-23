import { config } from "dotenv";
import { z } from "zod";

config({ path: ".env" });

export const baseEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

/**
 * Validate environment variables
 * @returns Validated environment variables
 */
export function validateEnv<T extends z.ZodRawShape>(
  appEnvSchema: T
): z.infer<z.ZodObject<T & typeof baseEnvSchema>> {
  return baseEnvSchema.extend(appEnvSchema).parse(process.env);
}
