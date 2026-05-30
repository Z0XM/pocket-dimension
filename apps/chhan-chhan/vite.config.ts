import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

// Accessed via globalThis so tooling (e.g. svelte-check) can load this config
// under Node, where the `Bun` global is not defined.
const bunEnv = (globalThis as { Bun?: { env: Record<string, string | undefined> } }).Bun?.env;
const port = bunEnv?.PORT ? Number(bunEnv.PORT) : undefined;

export default defineConfig({
  server: { port },
  plugins: [tailwindcss(), sveltekit()],
  resolve: {
    alias: {
      "pg-native": "./src/lib/pg-native-stub.js",
    },
  },
});
