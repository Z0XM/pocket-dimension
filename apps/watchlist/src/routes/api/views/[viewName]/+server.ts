import { db, schema } from "@pocket-dimension/db";
import { json } from "@sveltejs/kit";
import { and, asc, eq } from "drizzle-orm";
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

// PUT /api/views/[viewName] - Update a view
export const PUT: RequestHandler = async ({ params, locals, request, url }) => {
  const user = locals.user;
  const viewName = params.viewName;

  if (!user) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check email verification
  if (!user.emailVerified) {
    return json({ error: "Email not verified. Please verify your email to update views." }, { status: 403 });
  }

  if (!viewName) {
    return json({ error: "View name is required" }, { status: 400 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { name, setFavorite, filters: filtersFromBody } = body;

    // Find the view
    const [view] = await db
      .select()
      .from(schema.watchlistViews)
      .where(and(eq(schema.watchlistViews.userId, user.id), eq(schema.watchlistViews.name, viewName)));

    if (!view) {
      return json({ error: "View not found" }, { status: 404 });
    }

    const updateData: {
      name?: string;
      filters?: Record<string, string>;
      isFavorite?: boolean;
      favoriteDate?: Date | null;
      updatedById: string;
    } = {
      updatedById: user.id,
    };

    // Update name if provided
    if (name !== undefined && name !== null && name !== view.name) {
      // Check if new name already exists
      const [existingView] = await db
        .select()
        .from(schema.watchlistViews)
        .where(and(eq(schema.watchlistViews.userId, user.id), eq(schema.watchlistViews.name, name)));

      if (existingView && existingView.id !== view.id) {
        return json({ error: "View name already exists" }, { status: 409 });
      }

      updateData.name = name;
    }

    // Update filters if provided (from body or URL query params)
    if (filtersFromBody !== undefined && filtersFromBody !== null) {
      // Validate filters is an object
      if (typeof filtersFromBody === "object" && !Array.isArray(filtersFromBody)) {
        // Build filters object, only including valid filter keys
        const filters: Record<string, string> = {};
        if (filtersFromBody.filterLanguage && typeof filtersFromBody.filterLanguage === "string") {
          filters.filterLanguage = filtersFromBody.filterLanguage;
        }
        if (filtersFromBody.filterTags && typeof filtersFromBody.filterTags === "string") {
          filters.filterTags = filtersFromBody.filterTags;
        }
        if (filtersFromBody.filterProgress && typeof filtersFromBody.filterProgress === "string") {
          filters.filterProgress = filtersFromBody.filterProgress;
        }
        if (filtersFromBody.filterType && typeof filtersFromBody.filterType === "string") {
          filters.filterType = filtersFromBody.filterType;
        }
        if (filtersFromBody.sortBy && typeof filtersFromBody.sortBy === "string") {
          filters.sortBy = filtersFromBody.sortBy;
        }
        if (filtersFromBody.sortOrder && typeof filtersFromBody.sortOrder === "string") {
          filters.sortOrder = filtersFromBody.sortOrder;
        }
        if (filtersFromBody.q && typeof filtersFromBody.q === "string") {
          filters.q = filtersFromBody.q;
        }
        updateData.filters = filters;
      } else {
        return json({ error: "Filters must be an object" }, { status: 400 });
      }
    } else {
      // If filters not in body, check URL query parameters (for consistency with POST)
      const filterLanguage = url.searchParams.get("filterLanguage");
      const filterTags = url.searchParams.get("filterTags");
      const filterProgress = url.searchParams.get("filterProgress");
      const filterType = url.searchParams.get("filterType");
      const sortBy = url.searchParams.get("sortBy");
      const sortOrder = url.searchParams.get("sortOrder");
      const q = url.searchParams.get("q");

      // Only update filters if at least one filter param is present in URL
      if (filterLanguage || filterTags || filterProgress || filterType || sortBy || sortOrder || q) {
        const filters: Record<string, string> = {};
        if (filterLanguage) filters.filterLanguage = filterLanguage;
        if (filterTags) filters.filterTags = filterTags;
        if (filterProgress) filters.filterProgress = filterProgress;
        if (filterType) filters.filterType = filterType;
        if (sortBy) filters.sortBy = sortBy;
        if (sortOrder) filters.sortOrder = sortOrder;
        if (q) filters.q = q;
        updateData.filters = filters;
      }
    }

    // Handle setFavorite
    if (setFavorite === true) {
      // Only need to check limit if current view is not already a favorite
      if (!view.isFavorite) {
        // Check how many favorites exist
        const favoriteViews = await db
          .select()
          .from(schema.watchlistViews)
          .where(and(eq(schema.watchlistViews.userId, user.id), eq(schema.watchlistViews.isFavorite, true)))
          .orderBy(asc(schema.watchlistViews.favoriteDate));

        // If there are already 3 favorites, remove the oldest one
        if (favoriteViews.length >= 3) {
          const oldestFavorite = favoriteViews[0];
          await db
            .update(schema.watchlistViews)
            .set({
              isFavorite: false,
              favoriteDate: null,
              updatedById: user.id,
            })
            .where(eq(schema.watchlistViews.id, oldestFavorite.id));
        }
      }

      // Set this view as favorite (or update favorite date if already favorite)
      updateData.isFavorite = true;
      updateData.favoriteDate = new Date();
    } else if (setFavorite === false) {
      // Unset favorite
      updateData.isFavorite = false;
      updateData.favoriteDate = null;
    }

    // Update the view
    const [updatedView] = await db
      .update(schema.watchlistViews)
      .set(updateData)
      .where(and(eq(schema.watchlistViews.userId, user.id), eq(schema.watchlistViews.name, viewName)))
      .returning();

    // Transform filter JSON to URL format
    const filters = (updatedView.filters as Record<string, unknown>) || {};
    const urlString = filtersToUrl(filters);

    return json({
      view: {
        id: updatedView.id,
        name: updatedView.name,
        href: `/${urlString}`,
        isFavorite: updatedView.isFavorite,
        favoriteDate: updatedView.favoriteDate,
        createdAt: updatedView.createdAt,
        updatedAt: updatedView.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error updating view:", error);
    if (error instanceof Error && error.message.includes("unique")) {
      return json({ error: "View name already exists" }, { status: 409 });
    }
    return json({ error: "Failed to update view" }, { status: 500 });
  }
};

// DELETE /api/views/[viewName] - Delete a view
export const DELETE: RequestHandler = async ({ params, locals }) => {
  const user = locals.user;
  const viewName = params.viewName;

  if (!user) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check email verification
  if (!user.emailVerified) {
    return json({ error: "Email not verified. Please verify your email to delete views." }, { status: 403 });
  }

  if (!viewName) {
    return json({ error: "View name is required" }, { status: 400 });
  }

  try {
    // Find the view first to check if it exists
    const [view] = await db
      .select()
      .from(schema.watchlistViews)
      .where(and(eq(schema.watchlistViews.userId, user.id), eq(schema.watchlistViews.name, viewName)));

    if (!view) {
      return json({ error: "View not found" }, { status: 404 });
    }

    // Delete the view
    await db.delete(schema.watchlistViews).where(and(eq(schema.watchlistViews.userId, user.id), eq(schema.watchlistViews.name, viewName)));

    return json({ success: true });
  } catch (error) {
    console.error("Error deleting view:", error);
    return json({ error: "Failed to delete view" }, { status: 500 });
  }
};
