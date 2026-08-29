import path from "node:path";
import { createReadStream, existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { loadHeimdallConfig } from "../config/load.js";
import { resolveEffectiveBasePath, resolveRepoRoot } from "../config/resolveBasePath.js";
import type { HeimdallConfig } from "../config/schema.js";
import { packageRoot } from "../lib/packageRoot.js";
import { handleApiRequest, preloadDashboard, preloadDocsAsync, rebuildDashboard } from "../../server/apiState.js";
import { initHeimdallRuntime } from "../../server/runtime.js";
import { setRunnerAdapter, type RunnerAdapter } from "../../server/runners.js";

export type RegisterHeimdallOptions = {
  /**
   * Browser-facing effective public base (e.g. `/my-app/heimdall`).
   * When omitted, resolved from config (`basePath` / `basePathFromEnv` + `heimdallPath`).
   */
  basePath?: string;
  /**
   * Fastify mount path (ingress-stripped). Defaults to config `heimdallPath` (`/heimdall`).
   */
  mountPath?: string;
  /** Override cwd for config discovery. */
  cwd?: string;
  /** Proxy UI to Vite when set (or env HEIMDALL_VITE_PROXY=1). */
  viteProxy?: boolean;
  viteUrl?: string;
  /** Built SPA root (defaults to package `dist/`). */
  distDir?: string;
  /** Browser link overrides (e.g. host-prefixed api docs URLs). */
  links?: {
    apiDocs?: string | null;
    sample?: string | null;
  };
  /** Host-owned Vitest / Playwright runner implementation. */
  runners?: RunnerAdapter | null;
};

function injectHeimdallIndexHtml(
  html: string,
  runtime: {
    basePath: string;
    dashboardApiBase: string;
    apiDocsPath: string | null;
    samplePath: string | null;
    pages: {
      tests: boolean;
      testLevels?: HeimdallConfig["pages"]["testLevels"];
    };
    uiStoragePrefix?: string;
    defaultTheme?: "dark" | "light";
  }
): string {
  const baseHref = `${runtime.basePath || ""}/`.replace(/\/{2,}/g, "/") || "/";
  const script = `<script>window.__HEIMDALL_RUNTIME__=${JSON.stringify(runtime)};</script>`;
  let out = html.includes("<base ") ? html : html.replace("<head>", `<head>\n    <base href="${baseHref}" />`);
  return out.replace("</head>", `    ${script}\n  </head>`);
}

function requestRawBody(request: FastifyRequest): string | undefined {
  if (request.body == null) return undefined;
  if (typeof request.body === "string") return request.body;
  try {
    return JSON.stringify(request.body);
  } catch {
    return undefined;
  }
}

async function sendApi(request: FastifyRequest, reply: FastifyReply, apiPrefix: string): Promise<FastifyReply | void> {
  const url = new URL(request.url, "http://localhost");
  let pathname = url.pathname;
  if (pathname === apiPrefix) pathname = "/";
  else if (pathname.startsWith(`${apiPrefix}/`)) {
    pathname = pathname.slice(apiPrefix.length);
  }

  const result = await handleApiRequest(pathname, request.method, url.searchParams, requestRawBody(request));

  if (result.kind === "redirect") {
    return reply.redirect(result.location);
  }

  if (result.kind === "sse") {
    reply.hijack();
    reply.raw.writeHead(result.status, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-cache",
      Connection: "keep-alive",
    });
    let cleaned = false;
    let cleanup: () => void = () => undefined;
    const close = () => {
      if (cleaned) return;
      cleaned = true;
      clearInterval(heartbeat);
      cleanup();
      if (!reply.raw.writableEnded) reply.raw.end();
    };
    const heartbeat = setInterval(() => {
      if (cleaned || reply.raw.writableEnded) {
        clearInterval(heartbeat);
        return;
      }
      try {
        reply.raw.write(`: ping\n\n`);
      } catch {
        close();
      }
    }, 15_000);
    const send = (event: string, data: unknown) => {
      if (cleaned || reply.raw.writableEnded) return;
      try {
        reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      } catch {
        close();
      }
    };
    cleanup = result.attach(send);
    request.raw.on("close", close);
    reply.raw.on("error", close);
    return;
  }

  if (result.kind === "file") {
    reply.hijack();
    reply.raw.writeHead(result.status, {
      "Content-Type": result.contentType,
      "Cache-Control": "no-store",
    });
    if (result.body != null) {
      reply.raw.end(result.body);
    } else if (result.filePath) {
      createReadStream(result.filePath).pipe(reply.raw);
    } else {
      reply.raw.end();
    }
    return;
  }

  return reply.code(result.status).type("application/json").send(result.body);
}

function isHeimdallUiPath(pathname: string, mountPath: string, apiPrefix: string): boolean {
  if (pathname.startsWith(apiPrefix)) return false;
  return pathname === mountPath || pathname.startsWith(`${mountPath}/`);
}

/**
 * Embed Heimdall War Room on a Fastify host.
 * Fastify routes use `mountPath` (no host deploy prefix). Browser SPA uses
 * resolved effective `basePath` (host may join its deploy prefix via config).
 */
export async function registerHeimdall(
  app: FastifyInstance,
  options: RegisterHeimdallOptions = {}
): Promise<{ basePath: string; mountPath: string; config: HeimdallConfig }> {
  const cwd = options.cwd ?? process.cwd();
  const { config, configDir } = await loadHeimdallConfig(cwd);
  const repoRoot = resolveRepoRoot(config, cwd, configDir);
  const mountPath = (options.mountPath ?? config.runtime.heimdallPath ?? "/heimdall").replace(/\/$/, "") || "/heimdall";

  const basePath = options.basePath != null && options.basePath !== "" ? options.basePath.replace(/\/$/, "") : resolveEffectiveBasePath(config);

  // Ensure runtime uses the resolved repo root even if env was empty.
  process.env.HEIMDALL_REPO_ROOT = repoRoot;
  process.env.HEIMDALL_BASE_PATH = basePath;

  await initHeimdallRuntime({
    basePath,
    cwd,
  });
  setRunnerAdapter(options.runners ?? null);

  preloadDashboard();
  preloadDocsAsync();

  const apiPrefix = `${mountPath}/dev-api`;
  const viteProxy = options.viteProxy ?? process.env.HEIMDALL_VITE_PROXY === "1";
  const viteUrl = options.viteUrl ?? process.env.HEIMDALL_VITE_URL ?? "http://127.0.0.1:5176";
  const distDir = options.distDir ?? path.join(packageRoot(), "dist", "ui");

  const runtime = {
    basePath: basePath || mountPath,
    dashboardApiBase: `${basePath || mountPath}/dev-api`,
    apiDocsPath: options.links?.apiDocs !== undefined ? options.links.apiDocs : config.links.apiDocs,
    samplePath: options.links?.sample !== undefined ? options.links.sample : config.links.sample,
    pages: {
      tests: config.pages.tests === true,
      testLevels: config.pages.testLevels,
    },
    uiStoragePrefix: config.runtime.uiStoragePrefix,
    defaultTheme: config.branding.defaultTheme,
  };

  app.addHook("onRoute", (routeOptions) => {
    const url = routeOptions.url;
    if (typeof url === "string" && (url === mountPath || url.startsWith(`${mountPath}/`))) {
      routeOptions.schema = {
        ...(routeOptions.schema ?? {}),
        hide: true,
      } as never;
    }
  });

  app.all(`${apiPrefix}/*`, (req, reply) => sendApi(req, reply, apiPrefix));
  app.all(apiPrefix, (req, reply) => sendApi(req, reply, apiPrefix));

  // Soft reload when docs change (best-effort).
  try {
    const { watch } = await import("node:fs");
    const docsDir = path.join(repoRoot, config.paths.docsRoot);
    if (existsSync(docsDir)) {
      const watcher = watch(docsDir, { recursive: true }, () => {
        rebuildDashboard();
      });
      app.addHook("onClose", (_instance, done) => {
        watcher.close();
        done();
      });
    }
  } catch {
    // ignore
  }

  if (viteProxy) {
    const httpProxy = (await import("@fastify/http-proxy")).default;
    await app.register(httpProxy, {
      upstream: viteUrl,
      prefix: mountPath,
      rewritePrefix: mountPath,
      websocket: true,
      preValidation: async (request: FastifyRequest, reply: FastifyReply) => {
        const pathname = request.url.split("?")[0] ?? "";
        if (!isHeimdallUiPath(pathname, mountPath, apiPrefix)) {
          return reply.callNotFound();
        }
      },
    });
    app.log.info({ upstream: viteUrl, mountPath }, "Heimdall proxied to Vite");
    return { basePath: runtime.basePath, mountPath, config };
  }

  if (!existsSync(path.join(distDir, "index.html"))) {
    app.log.warn({ distDir }, "Heimdall dist/ missing — run `bun run build` in shared/heimdall, or set HEIMDALL_VITE_PROXY=1");
  }

  const fastifyStatic = (await import("@fastify/static")).default;

  async function sendIndex(reply: FastifyReply): Promise<FastifyReply> {
    const raw = await readFile(path.join(distDir, "index.html"), "utf-8");
    return reply.type("text/html; charset=utf-8").send(injectHeimdallIndexHtml(raw, runtime));
  }

  app.get(mountPath, async (_req, reply) => reply.redirect(`${mountPath}/`));

  await app.register(async (instance) => {
    await instance.register(fastifyStatic, {
      root: distDir,
      prefix: `${mountPath}/`,
      decorateReply: false,
      index: false,
    });

    instance.setNotFoundHandler(async (request, reply) => {
      const pathname = request.url.split("?")[0] ?? "";
      if (!isHeimdallUiPath(pathname, mountPath, apiPrefix)) {
        return reply.callNotFound();
      }
      if (pathname.includes(".") && !pathname.endsWith(".html")) {
        return reply.callNotFound();
      }
      return sendIndex(reply);
    });
  });

  // Explicit SPA index for `/heimdall/`
  app.get(`${mountPath}/`, async (_req, reply) => sendIndex(reply));

  app.log.info({ mountPath, basePath: runtime.basePath, distDir }, "Heimdall War Room registered");

  return { basePath: runtime.basePath, mountPath, config };
}

/** Helper for hosts that want to inject HTML themselves. */
export function buildHeimdallRuntimeConfig(
  config: HeimdallConfig,
  basePath: string
): {
  basePath: string;
  dashboardApiBase: string;
  apiDocsPath: string | null;
  samplePath: string | null;
  pages: {
    tests: boolean;
    testLevels?: HeimdallConfig["pages"]["testLevels"];
  };
  uiStoragePrefix: string;
  defaultTheme: "dark" | "light";
} {
  const base = basePath.replace(/\/$/, "") || "/heimdall";
  return {
    basePath: base,
    dashboardApiBase: `${base}/dev-api`,
    apiDocsPath: config.links.apiDocs,
    samplePath: config.links.sample,
    pages: {
      tests: config.pages.tests === true,
      testLevels: config.pages.testLevels,
    },
    uiStoragePrefix: config.runtime.uiStoragePrefix,
    defaultTheme: config.branding.defaultTheme,
  };
}
