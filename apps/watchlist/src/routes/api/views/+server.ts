import { db, schema } from "@pocket-dimension/db";
import { json } from "@sveltejs/kit";
import { desc, eq } from "drizzle-orm";
import type { RequestHandler } from "./$types";

// Helper function to transform filter JSON to URL query string
function filtersToUrl(filters: Record<string, unknown>): string {
  const params = new URLSearchParams();

  if (filters.filterLanguage && typeof filters.filterLanguage === "string") {
    params.set("filterLanguage", filters.filterLanguage);
  }
  if (filters.filterTags && typeof filters.filterTags === "string") {
    params.set("filterTags", filters.filterTags);
  }
  if (filters.filterProgress && typeof filters.filterProgress === "string") {
    params.set("filterProgress", filters.filterProgress);
  }
  if (filters.filterType && typeof filters.filterType === "string") {
    params.set("filterType", filters.filterType);
  }
  if (filters.sortBy && typeof filters.sortBy === "string") {
    params.set("sortBy", filters.sortBy);
  }
  if (filters.sortOrder && typeof filters.sortOrder === "string") {
    params.set("sortOrder", filters.sortOrder);
  }
  if (filters.q && typeof filters.q === "string") {
    params.set("q", filters.q);
  }

  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
}

// GET /api/views - Get all views for logged in user
export const GET: RequestHandler = async ({ locals }) => {
  const user = locals.user;

  if (!user) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const views = await db
      .select()
      .from(schema.watchlistViews)
      .where(eq(schema.watchlistViews.userId, user.id))
      .orderBy(desc(schema.watchlistViews.isFavorite), desc(schema.watchlistViews.favoriteDate), desc(schema.watchlistViews.createdAt));

    // Transform filter JSON to URL format
    const viewsWithUrl = views.map((view) => {
      const filters = (view.filters as Record<string, unknown>) || {};
      const url = filtersToUrl(filters);
      return {
        id: view.id,
        name: view.name,
        href: `/${url}`,
        isFavorite: view.isFavorite,
        favoriteDate: view.favoriteDate,
        createdAt: view.createdAt,
        updatedAt: view.updatedAt,
      };
    });

    return json({ views: viewsWithUrl });
  } catch (error) {
    console.error("Error fetching views:", error);
    return json({ error: "Failed to fetch views" }, { status: 500 });
  }
};

// POST /api/views - Create a new view
export const POST: RequestHandler = async ({ url, locals, request }) => {
  const user = locals.user;

  if (!user) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Check if user already has 10 views
    const existingViews = await db.select().from(schema.watchlistViews).where(eq(schema.watchlistViews.userId, user.id));

    if (existingViews.length >= 10) {
      return json({ error: "Maximum of 10 views allowed" }, { status: 400 });
    }

    // Extract filters from request URL query parameters
    const filterLanguage = url.searchParams.get("filterLanguage") || "";
    const filterTags = url.searchParams.get("filterTags") || "";
    const filterProgress = url.searchParams.get("filterProgress") || "";
    const filterType = url.searchParams.get("filterType") || "";
    const sortBy = url.searchParams.get("sortBy") || "";
    const sortOrder = url.searchParams.get("sortOrder") || "";
    const q = url.searchParams.get("q") || "";

    // Build filters JSON object
    const filters: Record<string, string> = {};
    if (filterLanguage) filters.filterLanguage = filterLanguage;
    if (filterTags) filters.filterTags = filterTags;
    if (filterProgress) filters.filterProgress = filterProgress;
    if (filterType) filters.filterType = filterType;
    if (sortBy) filters.sortBy = sortBy;
    if (sortOrder) filters.sortOrder = sortOrder;
    if (q) filters.q = q;

    // Generate default name: "View 1", "View 2", etc.
    const existingNames = existingViews.map((v) => v.name);
    let viewNumber = 1;
    let viewName = `View ${viewNumber}`;
    while (existingNames.includes(viewName)) {
      viewNumber++;
      viewName = `View ${viewNumber}`;
    }

    // Insert new view
    const [newView] = await db
      .insert(schema.watchlistViews)
      .values({
        userId: user.id,
        name: viewName,
        filters: filters,
        isFavorite: false,
        createdById: user.id,
        updatedById: user.id,
      })
      .returning();

    // Transform filter JSON to URL format
    const urlString = filtersToUrl(filters);

    return json({
      view: {
        id: newView.id,
        name: newView.name,
        href: `/${urlString}`,
        isFavorite: newView.isFavorite,
        favoriteDate: newView.favoriteDate,
        createdAt: newView.createdAt,
        updatedAt: newView.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error creating view:", error);
    // Check for unique constraint violation
    if (error instanceof Error && error.message.includes("unique")) {
      return json({ error: "View name already exists" }, { status: 409 });
    }
    return json({ error: "Failed to create view" }, { status: 500 });
  }
};
