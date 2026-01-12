import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  server: { port: Number(Bun.env.PORT) },
  plugins: [tailwindcss(), sveltekit()],
  resolve: {
    alias: {
      "pg-native": "./src/lib/pg-native-stub.js",
    },
  },
});
