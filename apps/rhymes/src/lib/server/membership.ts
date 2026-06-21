import type { schema } from "@pocket-dimension/db";

export type RhymesWorkspaceRole = "owner" | "admin" | "editor" | "contributor" | "viewer";

export interface RhymesWorkspaceAccess {
  role: RhymesWorkspaceRole | null;
  canCreate: boolean;
}

/**
 * Temporary bootstrap seam until rhymes_memberships lands in Story 5.1.
 * Maps verified global auth roles to rhymes workspace access for early creator gating.
 */
export function resolveRhymesWorkspaceAccess(user: typeof schema.user.$inferSelect | undefined): RhymesWorkspaceAccess {
  if (!user?.emailVerified) {
    return { role: null, canCreate: false };
  }

  if (user.role === "admin") {
    return { role: "owner", canCreate: true };
  }

  if (user.role === "contributor") {
    return { role: "contributor", canCreate: true };
  }

  return { role: "viewer", canCreate: false };
}

export function hasRhymesCreateAccess(user: typeof schema.user.$inferSelect | undefined): boolean {
  return resolveRhymesWorkspaceAccess(user).canCreate;
}
