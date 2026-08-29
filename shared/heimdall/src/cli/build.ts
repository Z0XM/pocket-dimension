import { spawnSync } from "node:child_process";
import { loadHeimdallConfig } from "../config/load.js";
import { resolveEffectiveBasePath } from "../config/resolveBasePath.js";
import { packageRoot } from "../lib/packageRoot.js";
import { resolveViteBin } from "../lib/resolveViteBin.js";

const pkgRoot = packageRoot();

export async function runBuild(): Promise<number> {
  const { config } = await loadHeimdallConfig();
  const basePath = resolveEffectiveBasePath(config);
  const viteBin = resolveViteBin(pkgRoot);
  const result = spawnSync(process.execPath, [viteBin, "build"], {
    cwd: pkgRoot,
    stdio: "inherit",
    shell: false,
    env: {
      ...process.env,
      VITE_HEIMDALL_BASE: basePath || "/",
      HEIMDALL_BASE_PATH: basePath,
    },
  });
  return result.status ?? 1;
}
