import node from "@astrojs/node";
import svelte from "@astrojs/svelte";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

// https://astro.build/config
export default defineConfig({
  output: "server", // Enable SSR mode
  adapter: node({
    mode: "standalone", // For containerized deployments
  }),
  integrations: [svelte()],
  vite: {
    plugins: [tailwindcss()],
  },
  server: {
    host: true, // Bind to 0.0.0.0 for Traefik
    port: 3003,
  },
});
