import { db, schema } from "@pocket-dimension/db";
import { json } from "@sveltejs/kit";
import { and, isNotNull, ne } from "drizzle-orm";
import type { RequestHandler } from "./$types";

// GET /api/users - Get all users with usernames only (excluding the logged-in user)
export const GET: RequestHandler = async ({ locals }) => {
  const user = locals.user;

  if (!user) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const users = await db
      .select({
        id: schema.user.id,
        username: schema.user.username,
      })
      .from(schema.user)
      .where(
        and(
          isNotNull(schema.user.username),
          ne(schema.user.id, user.id) // Exclude the logged-in user
        )
      );

    // Filter out null usernames in TypeScript as well (defensive)
    const validUsers = users
      .filter((u): u is { id: string; username: string } => u.username !== null)
      .map((u) => ({ id: u.id, username: u.username }));

    return json({ users: validUsers });
  } catch (error) {
    console.error("Error fetching users:", error);
    return json({ error: "Failed to fetch users" }, { status: 500 });
  }
};
