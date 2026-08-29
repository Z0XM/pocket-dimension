import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { loadHeimdallConfig, starterConfigSource } from "./config/load.js";
import { resolveEffectiveBasePath, resolveRepoRoot, resolveConfigPath } from "./config/resolveBasePath.js";
import { runDoctor } from "./cli/doctor.js";
import { runDev } from "./cli/dev.js";
import { runBuild } from "./cli/build.js";

function printHelp(): void {
  console.log(`Heimdall — BMAD / docs War Room

Usage:
  heimdall init [--force]   Write starter heimdall.config.ts
  heimdall doctor           Warn on missing configured paths (non-fatal)
  heimdall dev              Start API + Vite War Room
  heimdall build            Build SPA (vite build)

Product settings live in heimdall.config.ts (not Heimdall-specific env).
Host owns reverse-proxy prefixes; Heimdall receives an effective base via
config / registerHeimdall({ basePath }) / optional basePathFromEnv (consumer-named).
`);
}

export async function main(argv: string[]): Promise<number> {
  const [cmd, ...rest] = argv;

  if (!cmd || cmd === "help" || cmd === "--help" || cmd === "-h") {
    printHelp();
    return 0;
  }

  if (cmd === "init") {
    const force = rest.includes("--force");
    const target = path.resolve(process.cwd(), "heimdall.config.ts");
    if (existsSync(target) && !force) {
      console.error(`Refusing to overwrite ${target} (pass --force)`);
      return 1;
    }
    writeFileSync(target, starterConfigSource(), "utf-8");
    console.log(`Wrote ${target}`);
    return 0;
  }

  if (cmd === "doctor") {
    return runDoctor();
  }

  if (cmd === "dev") {
    return runDev(rest);
  }

  if (cmd === "build") {
    return runBuild();
  }

  console.error(`Unknown command: ${cmd}`);
  printHelp();
  return 1;
}

const isDirect = process.argv[1] && (process.argv[1].endsWith("cli.ts") || process.argv[1].endsWith("cli.cjs"));

if (isDirect) {
  main(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((err) => {
      console.error(err instanceof Error ? err.message : err);
      process.exitCode = 1;
    });
}

export { loadHeimdallConfig, resolveEffectiveBasePath, resolveRepoRoot, resolveConfigPath };
