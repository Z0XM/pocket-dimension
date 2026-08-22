import { kyselyCompat } from "./vite-kysely-compat";
import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

const bunEnv = (globalThis as { Bun?: { env: Record<string, string | undefined> } }).Bun?.env;
const port = bunEnv?.PORT ? Number(bunEnv.PORT) : 3004;

export default defineConfig({
  server: { port },
  plugins: [kyselyCompat(), tailwindcss(), sveltekit()],
  resolve: {
    alias: {
      "pg-native": "./src/lib/pg-native-stub.js",
    },
  },
});
