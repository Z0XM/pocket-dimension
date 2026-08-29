/**
 * Production entry: Fastify host + registerHeimdall (SPA + /heimdall/dev-api).
 *
 * Expected layout (Docker / Dokploy):
 *   /app/heimdall.config.mjs
 *   /app/_bmad-output/...
 *   /app/apps/heimdall/dist/{host.cjs,ui/...}
 *   /app/node_modules/...
 *
 * Env: see apps/heimdall/.env.example
 */
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";

const require = createRequire(import.meta.url);
const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { registerHeimdall } = require(path.join(appDir, "dist", "host.cjs"));

const repoRoot = process.env.HEIMDALL_REPO_ROOT
  ? path.resolve(process.env.HEIMDALL_REPO_ROOT)
  : path.resolve(appDir, "../..");

const port = Number(process.env.PORT ?? 3012);
const host = process.env.HOST ?? "0.0.0.0";

const mountOverride = process.env.HEIMDALL_MOUNT_PATH?.trim();
const baseOverride = process.env.HEIMDALL_BASE_PATH?.trim();

const app = Fastify({
  logger: true,
  // Traefik / reverse proxies may strip or preserve path prefixes.
  trustProxy: true,
});

const { mountPath, basePath } = await registerHeimdall(app, {
  cwd: repoRoot,
  distDir: path.join(appDir, "dist", "ui"),
  runners: null,
  ...(mountOverride ? { mountPath: mountOverride } : {}),
  ...(baseOverride ? { basePath: baseOverride } : {}),
});

const uiHome = `${mountPath}/`;
if (mountPath !== "" && mountPath !== "/") {
  app.get("/", async (_req, reply) => reply.redirect(uiHome));
}

await app.listen({ port, host });
app.log.info({ port, host, mountPath, basePath, repoRoot }, "Heimdall listening");
