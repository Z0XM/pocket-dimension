import { defineConfig } from "drizzle-kit";
import { env } from "./src/lib/env";

export default defineConfig({
  out: "./migrations",
  schema: [
    "./src/schema/auth.ts",
    "./src/schema/watchlist.ts",
    "./src/schema/howwasyourday.ts",
    "./src/schema/chhanchhan.ts",
    "./src/schema/meviayou.ts",
    "./src/schema/zeo.ts",
  ],
  dialect: "postgresql",
  dbCredentials: {
    url: env.DATABASE_URL,
  },
  casing: "snake_case",
});
