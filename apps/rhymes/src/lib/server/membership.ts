import { db, schema } from "@pocket-dimension/db";
import { eq, sql } from "drizzle-orm";
import type { schema as DbSchema } from "@pocket-dimension/db";

export type RhymesWorkspaceRole = "owner" | "admin" | "editor" | "contributor" | "viewer";

export interface RhymesWorkspaceAccess {
  role: RhymesWorkspaceRole | null;
  canCreate: boolean;
  canAdmin: boolean;
}

const CREATE_ROLES = new Set<RhymesWorkspaceRole>(["owner", "admin", "editor", "contributor"]);
const ADMIN_ROLES = new Set<RhymesWorkspaceRole>(["owner", "admin"]);

function fallbackRoleFromGlobalUser(user: typeof DbSchema.user.$inferSelect): RhymesWorkspaceRole | null {
  if (user.role === "admin") return "owner";
  if (user.role === "contributor") return "contributor";
  return "viewer";
}

export async function getRhymesMembership(userId: string) {
  const [membership] = await db
    .select()
    .from(schema.rhymesMemberships)
    .where(eq(schema.rhymesMemberships.userId, userId))
    .limit(1);

  return membership ?? null;
}

export function workspaceAccessFromRole(role: RhymesWorkspaceRole | null): RhymesWorkspaceAccess {
  return {
    role,
    canCreate: role ? CREATE_ROLES.has(role) : false,
    canAdmin: role ? ADMIN_ROLES.has(role) : false,
  };
}

export async function resolveRhymesWorkspaceAccess(
  user: typeof DbSchema.user.$inferSelect | undefined
): Promise<RhymesWorkspaceAccess> {
  if (!user?.emailVerified) {
    return { role: null, canCreate: false, canAdmin: false };
  }

  const membership = await getRhymesMembership(user.id);
  const role = membership?.role ?? fallbackRoleFromGlobalUser(user);
  return workspaceAccessFromRole(role);
}

export function hasRhymesCreateAccess(access: RhymesWorkspaceAccess): boolean {
  return access.canCreate;
}

export async function listMemberships() {
  return db
    .select({
      id: schema.rhymesMemberships.id,
      userId: schema.rhymesMemberships.userId,
      role: schema.rhymesMemberships.role,
      email: schema.user.email,
      username: schema.user.username,
      updatedAt: schema.rhymesMemberships.updatedAt,
    })
    .from(schema.rhymesMemberships)
    .innerJoin(schema.user, eq(schema.rhymesMemberships.userId, schema.user.id));
}

export async function upsertMembership(actorId: string, userId: string, role: RhymesWorkspaceRole) {
  const [membership] = await db
    .insert(schema.rhymesMemberships)
    .values({
      userId,
      role,
      createdById: actorId,
      updatedById: actorId,
    })
    .onConflictDoUpdate({
      target: schema.rhymesMemberships.userId,
      set: { role, updatedById: actorId, updatedAt: sql`now()` },
    })
    .returning();

  return membership;
}
