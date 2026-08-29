import os from "node:os";
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Avoid writing under node_modules/ (often sandbox-blocked outside workspace).
  cacheDir: path.join(os.tmpdir(), "heimdall-vitest-cache"),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    include: ["server/**/*.test.ts", "src/**/*.test.ts"],
  },
});
