import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { loadHeimdallConfig } from "../config/load.js";
import { resolveEffectiveBasePath, resolveRepoRoot } from "../config/resolveBasePath.js";
import { packageRoot } from "../lib/packageRoot.js";
import { resolveViteBin } from "../lib/resolveViteBin.js";

const pkgRoot = packageRoot();

export async function runDev(argv: string[]): Promise<number> {
  const portOverride = readFlag(argv, "--port");
  const { config, configPath, configDir } = await loadHeimdallConfig();
  const repoRoot = resolveRepoRoot(config, process.cwd(), configDir);
  const basePath = resolveEffectiveBasePath(config);
  const apiPort = config.dev.apiPort;
  const uiPort = portOverride ? Number(portOverride) : config.dev.uiPort;

  console.log(`[heimdall dev]`);
  console.log(`  config:   ${configPath ?? "(defaults)"}`);
  console.log(`  repoRoot: ${repoRoot}`);
  console.log(`  basePath: ${basePath || "/"}`);
  console.log(`  ui:       http://127.0.0.1:${uiPort}${basePath || ""}/`);
  console.log(`  api:      http://127.0.0.1:${apiPort}`);

  const children: ChildProcess[] = [];
  const env = {
    ...process.env,
    HEIMDALL_REPO_ROOT: repoRoot,
    HEIMDALL_BASE_PATH: basePath,
    HEIMDALL_API_PORT: String(apiPort),
    HEIMDALL_UI_PORT: String(uiPort),
    HEIMDALL_CONFIG_PATH: configPath ?? "",
    VITE_HEIMDALL_BASE: basePath || "/",
    VITE_STANDALONE_DEV: "1",
    VITE_INJECT_HEIMDALL_RUNTIME: "1",
    VITE_HEIMDALL_PAGES_TESTS: config.pages.tests ? "1" : "0",
    VITE_HEIMDALL_TEST_LEVELS: config.pages.testLevels?.join(",") ?? "",
    VITE_HEIMDALL_UI_STORAGE_PREFIX: config.runtime.uiStoragePrefix,
    VITE_HEIMDALL_DEFAULT_THEME: config.branding.defaultTheme,
    DASHBOARD_API_PORT: String(apiPort),
  };

  function run(label: string, command: string, args: string[]): ChildProcess {
    const child = spawn(command, args, {
      cwd: pkgRoot,
      stdio: "inherit",
      shell: false,
      env,
    });
    child.on("exit", (code) => {
      if (code && code !== 0) console.error(`[heimdall] ${label} exited with code ${code}`);
    });
    children.push(child);
    return child;
  }

  function shutdown(): void {
    for (const child of children) child.kill("SIGTERM");
    process.exit(0);
  }

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  console.log("[heimdall] Starting API…");
  run("api", process.execPath, ["--import", "tsx", path.join(pkgRoot, "server/apiServer.ts")]);

  await sleep(500);
  console.log("[heimdall] Starting Vite…");
  const viteBin = resolveViteBin(pkgRoot);
  run("vite", process.execPath, [viteBin, "--port", String(uiPort)]);

  await new Promise(() => undefined);
  return 0;
}

function readFlag(argv: string[], name: string): string | undefined {
  const idx = argv.indexOf(name);
  if (idx >= 0 && argv[idx + 1]) return argv[idx + 1];
  const eq = argv.find((a) => a.startsWith(`${name}=`));
  return eq?.slice(name.length + 1);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
