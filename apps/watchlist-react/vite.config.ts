import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

import viteTsConfigPaths from "vite-tsconfig-paths";

const config = defineConfig({
  server: {
    port: Number(Bun.env.PORT),
  },
  preview: {
    port: Number(Bun.env.PORT),
  },
  plugins: [
    devtools(),
    viteTsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    nitro({ preset: "bun" }),
    tailwindcss(),
    tanstackStart(),
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
    }),
    viteReact(),
  ],
});

export default config;
