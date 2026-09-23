import { auth, extractApiTokenFromHeaders, validateApiToken } from "@pocket-dimension/auth";
import type { schema } from "@pocket-dimension/db";
import { error } from "@sveltejs/kit";
import { getDataset } from "./registry";
import type { DatasetDefinition } from "./types";

export type ConnectorUser = typeof schema.user.$inferSelect;

/**
 * Resolve the acting user from session cookie or API token.
 * Public datasets may proceed with user=null.
 */
export async function resolveConnectorUser(request: Request, localsUser?: ConnectorUser | null): Promise<ConnectorUser | null> {
  if (localsUser) return localsUser;

  const raw = extractApiTokenFromHeaders(request.headers);
  if (!raw) {
    // Fall back to Better Auth session from request headers (API clients without locals).
    const session = await auth.api.getSession({ headers: request.headers });
    return (session?.user as ConnectorUser | undefined) ?? null;
  }

  const validated = await validateApiToken(raw);
  return validated?.user ?? null;
}

export function requireDataset(datasetId: string): DatasetDefinition {
  const dataset = getDataset(datasetId);
  if (!dataset) {
    throw error(404, { message: `Unknown dataset: ${datasetId}` });
  }
  return dataset;
}

/**
 * Enforce public/private access. Private datasets require a verified user.
 * Never expose private data without auth.
 */
export function assertDatasetAccess(dataset: DatasetDefinition, user: ConnectorUser | null, mode: "export" | "import"): void {
  if (mode === "import" && dataset.direction === "export") {
    throw error(405, { message: `Dataset ${dataset.id} does not support import` });
  }
  if (mode === "export" && dataset.direction === "import") {
    throw error(405, { message: `Dataset ${dataset.id} does not support export` });
  }

  if (dataset.access === "public" && mode === "export") {
    return;
  }

  // Private export/import, and public import (mutating catalog), need auth
  if (!user) {
    throw error(401, { message: "Authentication required. Sign in or provide an API token (Authorization: Bearer … or X-Api-Key)." });
  }
  if (!user.emailVerified) {
    throw error(403, { message: "Email verification required." });
  }
}

export function assertCatalogWriteRole(user: ConnectorUser): void {
  if (user.role !== "contributor" && user.role !== "admin") {
    throw error(403, { message: "Contributor or admin role required to import catalog data." });
  }
}
