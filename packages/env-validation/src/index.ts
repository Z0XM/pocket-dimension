import { z } from "zod";

/**
 * Base environment schema with common variables
 */
export const baseEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.string().transform(Number).pipe(z.number().int().positive()).default("3000"),
  HOST: z.string().default("localhost"),
});

/**
 * Parse and validate environment variables
 * @param schema - Zod schema to validate against
 * @param env - Environment variables object (defaults to process.env)
 * @returns Validated and parsed environment variables
 * @throws ZodError if validation fails
 */
export function validateEnv<T extends z.ZodTypeAny>(
  schema: T,
  env: Record<string, string | undefined> = process.env
): z.infer<T> {
  return schema.parse(env);
}

/**
 * Parse and validate environment variables with better error messages
 * @param schema - Zod schema to validate against
 * @param env - Environment variables object (defaults to process.env)
 * @returns Validated and parsed environment variables
 * @throws Error with formatted error messages if validation fails
 */
export function validateEnvSafe<T extends z.ZodTypeAny>(
  schema: T,
  env: Record<string, string | undefined> = process.env
): z.infer<T> {
  const result = schema.safeParse(env);

  if (!result.success) {
    const errors = result.error.errors.map((err) => {
      const path = err.path.join(".");
      return `${path}: ${err.message}`;
    });

    throw new Error(
      `Environment validation failed:\n${errors.join("\n")}\n\nPlease check your .env file and ensure all required variables are set.`
    );
  }

  return result.data;
}
