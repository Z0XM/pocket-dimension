import { z } from "zod";

const schema = z.object({
  PORT: z.string(),
  BETTER_AUTH_SECRET: z.string(),
  BETTER_AUTH_URL: z.url(),
});

export const env = Bun.env as z.infer<typeof schema>;
