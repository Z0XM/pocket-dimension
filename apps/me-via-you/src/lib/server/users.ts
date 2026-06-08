import { db, schema } from "@pocket-dimension/db";
import { eq } from "drizzle-orm";

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
