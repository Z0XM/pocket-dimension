import { error } from "@sveltejs/kit";
import { db, schema } from "@pocket-dimension/db";
import { and, eq } from "drizzle-orm";
import { resolveRhymesWorkspaceAccess } from "$lib/server/membership";
import { getPieceById } from "$lib/server/pieces";

export async function requireRhymesCreator(locals: App.Locals) {
  if (!locals.user?.id) {
    throw error(401, "Authentication required");
  }

  const access = await resolveRhymesWorkspaceAccess(locals.user);
  if (!access.canCreate) {
    throw error(403, "Rhymes creator access required");
  }

  return locals.user;
}

export async function requireRhymesAdmin(locals: App.Locals) {
  if (!locals.user?.id) {
    throw error(401, "Authentication required");
  }

  const access = await resolveRhymesWorkspaceAccess(locals.user);
  if (!access.canAdmin) {
    throw error(403, "Rhymes admin access required");
  }

  return locals.user;
}

export async function requireVerifiedUser(locals: App.Locals) {
  if (!locals.user?.id) {
    throw error(401, "Authentication required");
  }

  if (!locals.user.emailVerified) {
    throw error(403, "Email verification required");
  }

  return locals.user;
}

export async function canEditPiece(userId: string, pieceId: string): Promise<boolean> {
  const piece = await getPieceById(pieceId);
  if (!piece) return false;
  if (piece.authorId === userId) return true;

  const [user] = await db.select().from(schema.user).where(eq(schema.user.id, userId)).limit(1);
  if (!user) return false;

  const access = await resolveRhymesWorkspaceAccess(user);
  if (access.canAdmin || access.role === "editor") {
    return true;
  }

  const [permission] = await db
    .select()
    .from(schema.rhymesPiecePermissions)
    .where(and(eq(schema.rhymesPiecePermissions.pieceId, pieceId), eq(schema.rhymesPiecePermissions.userId, userId)))
    .limit(1);

  return Boolean(permission);
}

export async function requirePieceEditor(locals: App.Locals, pieceId: string) {
  const user = await requireRhymesCreator(locals);
  const allowed = await canEditPiece(user.id, pieceId);
  if (!allowed) {
    throw error(403, "You do not have edit access to this piece");
  }
  return user;
}

export async function grantPieceEditAccess(actorId: string, pieceId: string, userId: string) {
  const [permission] = await db
    .insert(schema.rhymesPiecePermissions)
    .values({
      pieceId,
      userId,
      permissionLevel: "edit",
      createdById: actorId,
      updatedById: actorId,
    })
    .onConflictDoUpdate({
      target: [schema.rhymesPiecePermissions.pieceId, schema.rhymesPiecePermissions.userId],
      set: { updatedById: actorId },
    })
    .returning();

  return permission;
}

export async function revokePieceEditAccess(pieceId: string, userId: string) {
  await db
    .delete(schema.rhymesPiecePermissions)
    .where(and(eq(schema.rhymesPiecePermissions.pieceId, pieceId), eq(schema.rhymesPiecePermissions.userId, userId)));
}
