import path from "node:path";
import type { Plugin } from "vite";

const heimdallBase = (process.env.VITE_HEIMDALL_BASE ?? process.env.HEIMDALL_BASE_PATH ?? "/heimdall").replace(/\/$/, "");
const reloadUrl =
  process.env.DASHBOARD_RELOAD_URL ??
  `http://127.0.0.1:${process.env.HEIMDALL_API_PORT ?? process.env.DASHBOARD_API_PORT ?? 5175}/api/dashboard/reload`;

function runtimeConfigScript(): string {
  const base = heimdallBase || "";
  const config = {
    basePath: base || "/",
    apiDocsPath: process.env.VITE_API_DOCS_PATH ?? null,
    samplePath: process.env.VITE_SAMPLE_PATH ?? null,
    dashboardApiBase: process.env.VITE_DASHBOARD_API_BASE ?? "/api",
    pages: {
      tests: process.env.VITE_HEIMDALL_PAGES_TESTS === "1",
      testLevels: process.env.VITE_HEIMDALL_TEST_LEVELS
        ? process.env.VITE_HEIMDALL_TEST_LEVELS.split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined,
    },
    uiStoragePrefix: process.env.VITE_HEIMDALL_UI_STORAGE_PREFIX || "heimdall",
    defaultTheme:
      process.env.VITE_HEIMDALL_DEFAULT_THEME === "light" || process.env.VITE_HEIMDALL_DEFAULT_THEME === "dark"
        ? process.env.VITE_HEIMDALL_DEFAULT_THEME
        : "dark",
  };
  return `<script>window.__HEIMDALL_RUNTIME__=${JSON.stringify(config)};</script>`;
}

export function heimdallPlugin(): Plugin {
  return {
    name: "heimdall-vite-plugin",
    transformIndexHtml(html) {
      if (process.env.VITE_INJECT_HEIMDALL_RUNTIME !== "1") return html;
      return html.replace("</head>", `    ${runtimeConfigScript()}\n  </head>`);
    },
    configureServer(server) {
      const base = heimdallBase || "";
      if (base) {
        server.middlewares.use((req, res, next) => {
          const raw = req.url ?? "/";
          const [pathname, search = ""] = raw.split("?");
          if (pathname === base) {
            const target = search ? `${base}/?${search}` : `${base}/`;
            res.writeHead(301, { Location: target });
            res.end();
            return;
          }
          next();
        });
      }

      server.watcher.on("change", (file) => {
        const hit = file.includes(`${path.sep}docs${path.sep}`) || file.includes(`${path.sep}_bmad-output${path.sep}`);
        if (!hit) return;

        fetch(reloadUrl, { method: "POST" })
          .then(() => {
            server.ws.send({ type: "custom", event: "dashboard:reload" });
          })
          .catch(() => {
            // API may still be starting
          });
      });
    },
  };
}
