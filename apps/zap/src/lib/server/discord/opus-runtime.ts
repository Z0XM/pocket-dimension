import { createRequire } from "node:module";
import Module from "node:module";

/**
 * Bun (node-v137 ABI) has no @discordjs/opus prebuild. prism-media tries that
 * package first and then opusscript — but a half-installed native module + Bun's
 * nested .bun store often makes *all* candidates fail.
 *
 * Force pure-JS opusscript and hide broken native packages from the loader.
 */
let ready = false;

export function ensureOpusRuntime() {
  if (ready) return;

  const require = createRequire(import.meta.url);

  // Make sure the pure-JS encoder is resolvable from this app package.
  try {
    require("opusscript");
  } catch (err) {
    throw new Error(
      `opusscript is required for Discord voice under Bun (native @discordjs/opus has no node-v137 prebuild). Install it in apps/zap. (${err instanceof Error ? err.message : err})`
    );
  }

  const mod = Module as typeof Module & {
    _resolveFilename: (request: string, parent: unknown, isMain: boolean, options?: unknown) => string;
  };
  const originalResolve = mod._resolveFilename.bind(Module);
  mod._resolveFilename = (request, parent, isMain, options) => {
    if (request === "@discordjs/opus" || request === "node-opus") {
      const err = new Error(`Cannot find package '${request}'`) as Error & { code: string };
      err.code = "MODULE_NOT_FOUND";
      throw err;
    }
    return originalResolve(request, parent, isMain, options);
  };

  ready = true;
}
