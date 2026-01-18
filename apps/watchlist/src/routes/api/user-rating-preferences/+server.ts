import { db, schema } from "@pocket-dimension/db";
import { json } from "@sveltejs/kit";
import { eq } from "drizzle-orm";
import type { RequestHandler } from "./$types";

// GET /api/user-rating-preferences - Get selected user IDs for current user
export const GET: RequestHandler = async ({ locals }) => {
  const user = locals.user;

  if (!user) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const preferences = await db
      .select({
        preferredUserId: schema.userRatingPreferences.preferredUserId,
      })
      .from(schema.userRatingPreferences)
      .where(eq(schema.userRatingPreferences.userId, user.id));

    const preferredUserIds = preferences.map((p) => p.preferredUserId);

    return json({ preferredUserIds });
  } catch (error) {
    console.error("Error fetching user rating preferences:", error);
    return json({ error: "Failed to fetch preferences" }, { status: 500 });
  }
};

// POST /api/user-rating-preferences - Save selected user IDs for current user
export const POST: RequestHandler = async ({ request, locals }) => {
  const user = locals.user;

  if (!user) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { preferredUserIds } = body as { preferredUserIds: string[] };

    if (!Array.isArray(preferredUserIds)) {
      return json({ error: "preferredUserIds must be an array" }, { status: 400 });
    }

    // Filter out the current user's ID (defensive check)
    const filteredUserIds = preferredUserIds.filter((id) => id !== user.id);

    // Delete existing preferences for this user
    await db.delete(schema.userRatingPreferences).where(eq(schema.userRatingPreferences.userId, user.id));

    // Insert new preferences if any
    if (filteredUserIds.length > 0) {
      const preferencesToInsert = filteredUserIds.map((preferredUserId) => ({
        userId: user.id,
        preferredUserId,
        createdById: user.id,
        updatedById: user.id,
      }));

      await db.insert(schema.userRatingPreferences).values(preferencesToInsert);
    }

    return json({ success: true });
  } catch (error) {
    console.error("Error saving user rating preferences:", error);
    return json({ error: "Failed to save preferences" }, { status: 500 });
  }
};
