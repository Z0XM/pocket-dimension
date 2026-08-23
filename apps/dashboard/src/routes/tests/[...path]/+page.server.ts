import { decodePathParam } from "$lib/docs-path";
import { resolveBmadRoot } from "$lib/server/bmad-root";
import type { PageServerLoad } from "./$types";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { basename, isAbsolute, join, relative } from "node:path";

const BINARY_CHECK_BYTES = 8192;

export const load: PageServerLoad = async ({ params }) => {
  const sourcePath = decodePathParam(params.path);
  const normalized = sourcePath.replace(/\\/g, "/").replace(/^\/+/, "");

  if (!normalized.startsWith("apps/") || normalized.includes("..")) {
    return {
      source: {
        kind: "error" as const,
        sourcePath: normalized,
        reason: "Invalid test path.",
      },
    };
  }

  const rootResult = resolveBmadRoot();
  if (!rootResult.ok) {
    return {
      source: {
        kind: "error" as const,
        sourcePath: normalized,
        reason: rootResult.error,
      },
    };
  }

  const appsPath = join(rootResult.root, "apps");
  const candidate = join(rootResult.root, ...normalized.split("/"));

  if (!existsSync(candidate)) {
    return {
      source: {
        kind: "error" as const,
        sourcePath: normalized,
        reason: "Test file not found.",
      },
    };
  }

  try {
    const resolvedApps = realpathSync(appsPath);
    const resolved = realpathSync(candidate);
    const rel = relative(resolvedApps, resolved);

    if (rel.startsWith("..") || isAbsolute(rel)) {
      return {
        source: {
          kind: "error" as const,
          sourcePath: normalized,
          reason: "Path is outside apps/.",
        },
      };
    }

    const buffer = readFileSync(resolved);
    if (buffer.subarray(0, Math.min(buffer.length, BINARY_CHECK_BYTES)).includes(0)) {
      return {
        source: {
          kind: "error" as const,
          sourcePath: normalized,
          reason: "Binary file.",
        },
      };
    }

    return {
      source: {
        kind: "text" as const,
        sourcePath: normalized,
        name: basename(normalized),
        text: buffer.toString("utf8"),
      },
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Could not read file.";
    return {
      source: {
        kind: "error" as const,
        sourcePath: normalized,
        reason,
      },
    };
  }
};
