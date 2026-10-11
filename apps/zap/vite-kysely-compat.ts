import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";

function createKyselyRequire(): NodeRequire {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  while (true) {
    const pkgJson = path.join(dir, "package.json");
    if (existsSync(pkgJson)) {
      try {
        const req = createRequire(pkgJson);
        req.resolve("kysely");
        return req;
      } catch {
        // walk up to the monorepo root (or any ancestor with kysely installed)
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error("vite-kysely-compat: could not resolve kysely — add it as a devDependency");
}

const require = createKyselyRequire();
const kyselyEntry = require.resolve("kysely");
const kyselyMigration = path.join(path.dirname(kyselyEntry), "migration/migrator.js");
const virtualId = "\0kysely-compat";

/**
 * Kysely 0.29 moved DEFAULT_MIGRATION_* exports to "kysely/migration", but
 * @better-auth/kysely-adapter still imports them from "kysely". Rollup fails
 * during SSR bundling; this virtual module restores the old export surface.
 */
export function kyselyCompat(): Plugin {
  return {
    name: "kysely-compat",
    enforce: "pre",
    resolveId(source) {
      if (source === "kysely") {
        return virtualId;
      }
    },
    load(id) {
      if (id === virtualId) {
        return `
export * from ${JSON.stringify(kyselyEntry)};
export { DEFAULT_MIGRATION_TABLE, DEFAULT_MIGRATION_LOCK_TABLE } from ${JSON.stringify(kyselyMigration)};
`;
      }
    },
  };
}
