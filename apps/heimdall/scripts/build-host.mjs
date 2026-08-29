import * as esbuild from "esbuild";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(root, "dist");

/** CJS bundles must not leave import.meta.url empty (fileURLToPath throws). */
const cjsImportMetaBanner =
  'var __heimdall_import_meta_url = require("url").pathToFileURL(__filename).href;';

const shared = {
  bundle: true,
  platform: "node",
  target: "node18",
  format: "cjs",
  banner: { js: cjsImportMetaBanner },
  define: {
    "import.meta.url": "__heimdall_import_meta_url",
  },
  external: [
    "fastify",
    "@fastify/static",
    "@fastify/http-proxy",
    "fastify-plugin",
    "react",
    "react-dom",
    "react-router-dom",
    "vite",
  ],
  logLevel: "info",
};

fs.mkdirSync(distDir, { recursive: true });

async function buildEntry(entry, outName) {
  const outfile = path.join(distDir, outName);
  try {
    await esbuild.build({
      ...shared,
      entryPoints: [path.join(root, entry)],
      outfile,
    });
  } catch {
    // Sandbox may block writes into packages repo dist/; build to tmp then copy.
    const tmp = path.join(os.tmpdir(), `heimdall-${outName}`);
    await esbuild.build({
      ...shared,
      entryPoints: [path.join(root, entry)],
      outfile: tmp,
    });
    fs.writeFileSync(outfile, fs.readFileSync(tmp));
    fs.unlinkSync(tmp);
  }
  console.log(`Wrote ${outfile}`);
}

await buildEntry("src/index.ts", "host.cjs");
await buildEntry("src/cli.ts", "cli.cjs");
