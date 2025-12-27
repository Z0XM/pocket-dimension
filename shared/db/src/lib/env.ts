import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.url({ message: "DATABASE_URL must be a valid URL" }),
});

export const env = Bun.env as z.infer<typeof schema>;
