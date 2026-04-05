import { db, schema } from "@pocket-dimension/db";
import { and, eq } from "drizzle-orm";
import { error } from "@sveltejs/kit";

export function requireUser(locals: App.Locals) {
  if (!locals.user?.id) {
    throw error(401, "Authentication required");
  }
  return locals.user;
}

export async function getMembershipOrThrow(userId: string, accountId: string) {
  const membership = await db.query.financeAccountMembers.findFirst({
    where: and(eq(schema.financeAccountMembers.accountId, accountId), eq(schema.financeAccountMembers.userId, userId)),
  });

  if (!membership) {
    throw error(403, "You do not have access to this account");
  }
  return membership;
}

export function canEdit(role: (typeof schema.accountMemberRole.enumValues)[number]) {
  return role === "owner" || role === "editor";
}
