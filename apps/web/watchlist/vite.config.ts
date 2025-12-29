import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  server: { port: Number(Bun.env.PORT) || 3000 },
  plugins: [tailwindcss(), sveltekit()],
});
