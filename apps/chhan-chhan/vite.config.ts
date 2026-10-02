import { kyselyCompat } from "./vite-kysely-compat";
import { betterAuthDedupe, betterAuthSsrExternal } from "@pocket-dimension/auth/vite-ssr";
import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import dns from "node:dns";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";

const root = path.dirname(fileURLToPath(import.meta.url));

// Node SSR does not auto-load `.env` the way `bun --bun` does. Merge all keys so
// externalized `@pocket-dimension/auth` can validate under Vite's Node SSR runner.
Object.assign(process.env, loadEnv(process.env.NODE_ENV ?? "development", root, ""));

if (typeof (globalThis as { Bun?: unknown }).Bun === "undefined") {
  (globalThis as { Bun: { env: NodeJS.ProcessEnv } }).Bun = { env: process.env };
} else {
  Object.assign((globalThis as { Bun: { env: NodeJS.ProcessEnv } }).Bun.env, process.env);
}

// Prefer 127.0.0.1 when resolving `localhost` (WSL/Node often pick ::1 first).
dns.setDefaultResultOrder("ipv4first");

const bunEnv = (globalThis as { Bun?: { env: Record<string, string | undefined> } }).Bun?.env;
const port = bunEnv?.PORT ? Number(bunEnv.PORT) : 3005;

export default defineConfig({
  server: {
    port,
    // Dual-stack so Windows `localhost` (::1) and `127.0.0.1` both reach the app.
    host: "::",
    strictPort: true,
    watch: {
      usePolling: false,
      ignored: ["**/node_modules/**", "**/.git/**", "**/dist/**", "**/build/**", "**/.turbo/**"],
    },
  },
  plugins: [kyselyCompat(), tailwindcss(), sveltekit()],
  resolve: {
    alias: {
      "pg-native": "./src/lib/pg-native-stub.js",
    },
    dedupe: [...betterAuthDedupe],
  },
  ssr: {
    external: [...betterAuthSsrExternal],
  },
  optimizeDeps: {
    // Barrel `@lucide/svelte` is multi-MB; apps should import `@lucide/svelte/icons/...`.
    exclude: ["@lucide/svelte"],
  },
});
