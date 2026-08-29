#!/usr/bin/env node
/**
 * Heimdall CLI entry.
 * Uses dist/cli.cjs when present; otherwise TypeScript via tsx.
 * Set HEIMDALL_FORCE_SRC=1 to always use src (linked/dev debugging).
 */
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");

const pkgRoot = path.resolve(__dirname, "..");
const distCli = path.join(pkgRoot, "dist", "cli.cjs");
const srcCli = path.join(pkgRoot, "src", "cli.ts");
const args = process.argv.slice(2);
const forceSrc = process.env.HEIMDALL_FORCE_SRC === "1";

function run(nodeArgs) {
  const result = spawnSync(process.execPath, nodeArgs, {
    stdio: "inherit",
    cwd: process.cwd(),
    env: process.env,
  });
  process.exit(result.status ?? 1);
}

if (!forceSrc && fs.existsSync(distCli)) {
  run([distCli, ...args]);
}

if (fs.existsSync(srcCli)) {
  run(["--import", "tsx", srcCli, ...args]);
}

if (fs.existsSync(distCli)) {
  run([distCli, ...args]);
}

console.error("Heimdall CLI not found (expected dist/cli.cjs or src/cli.ts)");
process.exit(1);
