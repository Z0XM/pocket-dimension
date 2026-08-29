import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { heimdallPlugin } from "./server/vitePlugin.js";

const standaloneDev = process.env.VITE_STANDALONE_DEV === "1";
const heimdallBase = (process.env.VITE_HEIMDALL_BASE ?? process.env.HEIMDALL_BASE_PATH ?? "/heimdall").replace(/\/$/, "");
const uiPort = Number(process.env.HEIMDALL_UI_PORT ?? 5174);
const apiPort = Number(process.env.HEIMDALL_API_PORT ?? process.env.DASHBOARD_API_PORT ?? 5175);
const repoRoot = process.env.HEIMDALL_REPO_ROOT ? path.resolve(process.env.HEIMDALL_REPO_ROOT) : path.resolve(__dirname, "..");

export default defineConfig({
  base: standaloneDev ? `${heimdallBase || ""}/` || "/" : "./",
  plugins: [react(), tailwindcss(), heimdallPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  /**
   * Workspace / `file:` installs can resolve transitive CJS (e.g. style-to-js) into the
   * consumer store and Vite serves them via `@fs` without ESM interop.
   * Force pre-bundle so `import x from 'style-to-js'` works.
   */
  optimizeDeps: {
    include: [
      "react-markdown",
      "remark-gfm",
      "hast-util-to-jsx-runtime",
      "hast-util-to-jsx-runtime > style-to-js",
      "style-to-js > style-to-object",
      "style-to-object > inline-style-parser",
    ],
  },
  server: {
    port: uiPort,
    strictPort: true,
    host: true,
    proxy: {
      "/api": {
        target: `http://127.0.0.1:${apiPort}`,
        changeOrigin: true,
      },
    },
    fs: {
      // Consumer repo + package root + node_modules for workspace installs
      allow: [repoRoot, __dirname, path.resolve(repoRoot, "node_modules")],
    },
  },
  root: ".",
  build: {
    outDir: "dist/ui",
    emptyOutDir: true,
  },
});
