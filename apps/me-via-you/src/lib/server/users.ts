import { db, schema } from "@pocket-dimension/db";
import type { PublicUserProfile } from "$lib/form-utils";
import { eq } from "drizzle-orm";

export type { PublicUserProfile };

export async function getPublicProfileByUserId(userId: string): Promise<PublicUserProfile | null> {
  const [user] = await db
    .select({
      username: schema.user.username,
      displayName: schema.user.name,
    })
    .from(schema.user)
    .where(eq(schema.user.id, userId))
    .limit(1);

  if (!user?.username) return null;

  return {
    username: user.username,
    displayName: user.displayName,
  };
}

export async function getUsernameByUserId(userId: string) {
  const profile = await getPublicProfileByUserId(userId);
  return profile?.username ?? null;
}

export async function getUserByUsername(username: string) {
  const [user] = await db
    .select({
      id: schema.user.id,
      username: schema.user.username,
    })
    .from(schema.user)
    .where(eq(schema.user.username, username))
    .limit(1);

  return user ?? null;
}
