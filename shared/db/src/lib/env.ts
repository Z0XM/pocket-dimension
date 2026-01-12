import { validateEnv } from "@pocket-dimension/utils";
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.url(),
});

let _env: z.infer<typeof schema> | null = null;

export const env = new Proxy({} as z.infer<typeof schema>, {
  get(_, prop: string) {
    if (!_env) {
      _env = validateEnv("db", schema, Bun.env);
    }
    return _env[prop as keyof typeof _env];
  },
});
