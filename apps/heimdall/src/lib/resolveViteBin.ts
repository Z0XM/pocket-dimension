import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

/**
 * Resolve vite CLI under Bun workspace / file: installs.
 * Hardcoding `<pkg>/node_modules/vite/...` fails when vite is a sibling under
 * `node_modules/` (hoisted or virtual store), not nested inside the package root.
 */
export function resolveViteBin(pkgRoot: string): string {
  const nested = path.join(pkgRoot, "node_modules", "vite", "bin", "vite.js");
  if (fs.existsSync(nested)) return nested;

  try {
    const require = createRequire(path.join(pkgRoot, "package.json"));
    const vitePkgJson = require.resolve("vite/package.json");
    const resolved = path.join(path.dirname(vitePkgJson), "bin", "vite.js");
    if (fs.existsSync(resolved)) return resolved;
  } catch {
    // fall through
  }

  throw new Error(
    `Cannot find vite for @pocket-dimension/heimdall (looked under ${pkgRoot} and Node resolution). ` +
      `Reinstall the package so its vite dependency is present.`
  );
}
