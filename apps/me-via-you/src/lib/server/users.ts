import { db, schema } from "@pocket-dimension/db";
import { eq } from "drizzle-orm";

export async function getUsernameByUserId(userId: string) {
  const [user] = await db
    .select({
      username: schema.user.username,
    })
    .from(schema.user)
    .where(eq(schema.user.id, userId))
    .limit(1);

  return user?.username ?? null;
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
