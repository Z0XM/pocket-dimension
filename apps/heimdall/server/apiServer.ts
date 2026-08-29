import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createReadStream } from "node:fs";
import { handleApiRequest, preloadDashboard, preloadDocsAsync, rebuildDashboard } from "./apiState.js";
import { initHeimdallRuntime } from "./runtime.js";
import { setRunnerAdapter } from "./runners.js";
import { createDogfoodVitestRunner } from "./dogfoodVitestRunner.js";

async function main(): Promise<void> {
  await initHeimdallRuntime();
  // Standalone `heimdall dev` — Vitest-only dogfood adapter (AD-14: hosts still inject via registerHeimdall).
  setRunnerAdapter(createDogfoodVitestRunner());
  const PORT = Number(process.env.HEIMDALL_API_PORT ?? process.env.DASHBOARD_API_PORT ?? 5175);

  function readBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve) => {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
      });
      req.on("end", () => resolve(body));
    });
  }

  function writeSseHeaders(res: ServerResponse): void {
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });
  }

  async function onRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`);

    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      });
      res.end();
      return;
    }

    try {
      const rawBody = req.method === "POST" || req.method === "PUT" || req.method === "DELETE" ? await readBody(req) : undefined;
      const result = await handleApiRequest(url.pathname, req.method ?? "GET", url.searchParams, rawBody);

      if (result.kind === "sse") {
        writeSseHeaders(res);
        let cleaned = false;
        let cleanup: () => void = () => undefined;
        const close = () => {
          if (cleaned) return;
          cleaned = true;
          clearInterval(heartbeat);
          cleanup();
          if (!res.writableEnded) res.end();
        };
        const heartbeat = setInterval(() => {
          if (cleaned || res.writableEnded) {
            clearInterval(heartbeat);
            return;
          }
          try {
            res.write(`: ping\n\n`);
          } catch {
            close();
          }
        }, 15_000);
        const send = (event: string, data: unknown) => {
          if (cleaned || res.writableEnded) return;
          try {
            res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
          } catch {
            close();
          }
        };
        cleanup = result.attach(send);
        req.on("close", close);
        res.on("error", close);
        return;
      }

      if (result.kind === "redirect") {
        res.writeHead(result.status, {
          Location: result.location,
          "Cache-Control": "no-store",
          "Access-Control-Allow-Origin": "*",
        });
        res.end();
        return;
      }

      if (result.kind === "file") {
        res.writeHead(result.status, {
          "Content-Type": result.contentType,
          "Cache-Control": "no-store",
          "Access-Control-Allow-Origin": "*",
        });
        if (result.body != null) {
          res.end(result.body);
        } else if (result.filePath) {
          createReadStream(result.filePath).pipe(res);
        } else {
          res.end();
        }
        return;
      }

      res.writeHead(result.status, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
      });
      res.end(JSON.stringify(result.body));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: String(err) }));
    }
  }

  preloadDashboard();
  preloadDocsAsync();

  const server = createServer((req, res) => {
    void onRequest(req, res);
  });

  server.listen(PORT, "127.0.0.1", () => {
    console.log(`[api] listening on http://127.0.0.1:${PORT}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

export function notifyReload(): void {
  rebuildDashboard();
}
