import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Package root whether running from `src/` or bundled `dist/*.cjs`.
 * Never call fileURLToPath on an empty import.meta.url (esbuild CJS leaves it empty).
 */
export function packageRoot(): string {
  // CJS / tsx often provide __dirname for the emitting file.
  if (typeof __dirname === "string" && __dirname.length > 0) {
    if (path.basename(__dirname) === "dist") return path.resolve(__dirname, "..");
    // src/lib | src/cli | src/host → package root
    if (path.basename(path.dirname(__dirname)) === "src") {
      return path.resolve(__dirname, "../..");
    }
    return path.resolve(__dirname, "../..");
  }

  let metaUrl = "";
  try {
    // May be empty string when esbuild CJS-bundles without define/banner.
    metaUrl = String(import.meta.url ?? "");
  } catch {
    metaUrl = "";
  }
  if (metaUrl.startsWith("file:")) {
    const here = path.dirname(fileURLToPath(metaUrl));
    if (path.basename(here) === "dist") return path.resolve(here, "..");
    return path.resolve(here, "../..");
  }

  // Last resort: assume cwd is the package (or consumer) root for CLI.
  return process.cwd();
}
