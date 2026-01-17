import { db, schema } from "@pocket-dimension/db";
import { json } from "@sveltejs/kit";
import { and, eq, ne } from "drizzle-orm";
import type { RequestHandler } from "./$types";

/**
 * GET /api/watchlist/validate-title
 * Checks if a title is unique (excluding a specific ID if provided)
 *
 * Query params:
 *   - title: The title to check
 *   - excludeId: (optional) ID of the watch item to exclude from the check
 *
 * Returns:
 *   - { isUnique: boolean }
 */
export const GET: RequestHandler = async ({ url }) => {
  const title = url.searchParams.get("title");
  const excludeId = url.searchParams.get("excludeId");

  if (!title) {
    return json({ error: "Title is required" }, { status: 400 });
  }

  try {
    // Check if a watch item with this title exists
    let condition = eq(schema.watchItems.title, title.trim());

    // If excludeId is provided and not a temp ID, exclude it from the check
    if (excludeId && !excludeId.startsWith("temp-")) {
      condition = and(eq(schema.watchItems.title, title.trim()), ne(schema.watchItems.id, excludeId)) as typeof condition;
    }

    const existing = await db.select({ id: schema.watchItems.id }).from(schema.watchItems).where(condition).limit(1);

    return json({ isUnique: existing.length === 0 });
  } catch (error) {
    console.error("Error validating title:", error);
    return json({ error: "Failed to validate title" }, { status: 500 });
  }
};
