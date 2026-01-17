import { db, schema } from "@pocket-dimension/db";
import { json } from "@sveltejs/kit";
import { and, eq, inArray } from "drizzle-orm";
import type { RequestHandler } from "./$types";

interface UpdateItem {
  id: string;
  title?: string;
  languageId?: string;
  type?: string;
  addTags?: string[];
  removeTags?: string[];
  rating?: number | null;
  infinity?: boolean;
  shitty?: boolean;
  progressStatus?: string | null;
}

interface NewItem {
  tempId: string;
  title: string;
  languageId: string;
  type: string;
  tags?: string[];
}

interface BulkUpdateRequest {
  updates: UpdateItem[];
  newItems: NewItem[];
  deleteIds: string[];
}

interface BulkUpdateError {
  id: string;
  field?: string;
  message: string;
}

/**
 * POST /api/watchlist/bulk-update
 * Handles bulk updates, creates, and deletes for watch items
 */
export const POST: RequestHandler = async ({ request, locals }) => {
  const user = locals.user;

  if (!user) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRole = user.role;
  const isContributor = userRole === "contributor" || userRole === "admin";
  const isAdmin = userRole === "admin";

  try {
    const body = (await request.json()) as BulkUpdateRequest;
    const { updates = [], newItems = [], deleteIds = [] } = body;

    const errors: BulkUpdateError[] = [];
    const results = {
      created: [] as Array<{ tempId: string; newId: string }>,
      updated: [] as string[],
      deleted: [] as string[],
    };

    // Validate role permissions
    if (newItems.length > 0 && !isContributor) {
      return json({ error: "Only contributors and admins can add new items" }, { status: 403 });
    }

    if (deleteIds.length > 0 && !isAdmin) {
      return json({ error: "Only admins can delete items" }, { status: 403 });
    }

    // Check if any updates contain contributor-only fields from a regular user
    if (!isContributor) {
      for (const update of updates) {
        if (
          update.title !== undefined ||
          update.languageId !== undefined ||
          update.type !== undefined ||
          update.addTags !== undefined ||
          update.removeTags !== undefined
        ) {
          return json(
            {
              error: "Only contributors and admins can edit title, language, type, and tags",
            },
            { status: 403 }
          );
        }
      }
    }

    // Process updates
    for (const update of updates) {
      try {
        await processUpdate(update, user, errors, results);
      } catch (error) {
        console.error(`Error processing update for ${update.id}:`, error);
        errors.push({
          id: update.id,
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    // Process new items
    for (const newItem of newItems) {
      try {
        await processNewItem(newItem, user, errors, results);
      } catch (error) {
        console.error(`Error processing new item ${newItem.tempId}:`, error);
        errors.push({
          id: newItem.tempId,
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    // Process deletes
    for (const deleteId of deleteIds) {
      try {
        await processDelete(deleteId, user, errors, results);
      } catch (error) {
        console.error(`Error deleting item ${deleteId}:`, error);
        errors.push({
          id: deleteId,
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    const success = errors.length === 0;

    return json({
      success,
      results,
      errors,
    });
  } catch (error) {
    console.error("Bulk update error:", error);
    return json({ error: "Failed to process bulk update" }, { status: 500 });
  }
};

async function processUpdate(update: UpdateItem, user: NonNullable<App.Locals["user"]>, errors: BulkUpdateError[], results: { updated: string[] }) {
  const watchItemUpdates: Partial<typeof schema.watchItems.$inferInsert> = {};
  let hasWatchItemUpdates = false;

  // Build watch item updates
  if (update.title !== undefined) {
    watchItemUpdates.title = update.title;
    hasWatchItemUpdates = true;
  }
  if (update.languageId !== undefined) {
    watchItemUpdates.languageId = update.languageId;
    hasWatchItemUpdates = true;
  }
  if (update.type !== undefined) {
    watchItemUpdates.type = update.type as "movie" | "series" | "shorts";
    hasWatchItemUpdates = true;
  }

  // Update watch item if there are changes
  if (hasWatchItemUpdates) {
    watchItemUpdates.updatedById = user.id;
    await db.update(schema.watchItems).set(watchItemUpdates).where(eq(schema.watchItems.id, update.id));
  }

  // Handle rating updates
  const hasRatingUpdates =
    update.rating !== undefined || update.infinity !== undefined || update.shitty !== undefined || update.progressStatus !== undefined;

  if (hasRatingUpdates) {
    // Check if rating record exists
    const existingRating = await db
      .select()
      .from(schema.watchItemRatings)
      .where(and(eq(schema.watchItemRatings.watchItemId, update.id), eq(schema.watchItemRatings.userId, user.id)))
      .limit(1);

    const ratingData: Partial<typeof schema.watchItemRatings.$inferInsert> = {
      updatedById: user.id,
    };

    if (update.rating !== undefined) {
      ratingData.rating = update.rating?.toString() ?? null;
    }
    if (update.infinity !== undefined) {
      ratingData.infinity = update.infinity;
    }
    if (update.shitty !== undefined) {
      ratingData.shitty = update.shitty;
    }
    if (update.progressStatus !== undefined) {
      ratingData.progressStatus = update.progressStatus as any;
    }

    if (existingRating.length > 0) {
      // Update existing rating
      await db
        .update(schema.watchItemRatings)
        .set(ratingData)
        .where(and(eq(schema.watchItemRatings.watchItemId, update.id), eq(schema.watchItemRatings.userId, user.id)));
    } else {
      // Create new rating
      await db.insert(schema.watchItemRatings).values({
        watchItemId: update.id,
        userId: user.id,
        createdById: user.id,
        ...ratingData,
      });
    }
  }

  // Handle tag removals
  if (update.removeTags && update.removeTags.length > 0) {
    // Get tag IDs for the tag names
    const tagsToRemove = await db.select({ id: schema.watchTags.id }).from(schema.watchTags).where(inArray(schema.watchTags.name, update.removeTags));

    if (tagsToRemove.length > 0) {
      const tagIds = tagsToRemove.map((t) => t.id);
      await db
        .delete(schema.watchItemTags)
        .where(and(eq(schema.watchItemTags.watchItemId, update.id), inArray(schema.watchItemTags.watchTagId, tagIds)));
    }
  }

  // Handle tag additions
  if (update.addTags && update.addTags.length > 0) {
    for (const tagName of update.addTags) {
      await addTagToItem(update.id, tagName, user.id);
    }
  }

  results.updated.push(update.id);
}

async function processNewItem(
  newItem: NewItem,
  user: NonNullable<App.Locals["user"]>,
  errors: BulkUpdateError[],
  results: { created: Array<{ tempId: string; newId: string }> }
) {
  // Validate required fields
  if (!newItem.title?.trim()) {
    errors.push({ id: newItem.tempId, field: "title", message: "Title is required" });
    return;
  }
  if (!newItem.languageId) {
    errors.push({ id: newItem.tempId, field: "languageId", message: "Language is required" });
    return;
  }
  if (!newItem.type) {
    errors.push({ id: newItem.tempId, field: "type", message: "Type is required" });
    return;
  }

  // Check title uniqueness
  const existingTitle = await db
    .select({ id: schema.watchItems.id })
    .from(schema.watchItems)
    .where(eq(schema.watchItems.title, newItem.title.trim()))
    .limit(1);

  if (existingTitle.length > 0) {
    errors.push({ id: newItem.tempId, field: "title", message: "A watch item with this title already exists" });
    return;
  }

  // Create the watch item
  const [created] = await db
    .insert(schema.watchItems)
    .values({
      title: newItem.title.trim(),
      languageId: newItem.languageId,
      type: newItem.type as "movie" | "series" | "shorts",
      createdById: user.id,
      updatedById: user.id,
    })
    .returning({ id: schema.watchItems.id });

  // Add tags if any
  if (newItem.tags && newItem.tags.length > 0) {
    for (const tagName of newItem.tags) {
      await addTagToItem(created.id, tagName, user.id);
    }
  }

  results.created.push({ tempId: newItem.tempId, newId: created.id });
}

async function processDelete(deleteId: string, user: NonNullable<App.Locals["user"]>, errors: BulkUpdateError[], results: { deleted: string[] }) {
  // Delete the watch item (cascades to ratings and tags due to ON DELETE CASCADE)
  const deleted = await db.delete(schema.watchItems).where(eq(schema.watchItems.id, deleteId)).returning({ id: schema.watchItems.id });

  if (deleted.length > 0) {
    results.deleted.push(deleteId);
  } else {
    errors.push({ id: deleteId, message: "Item not found or already deleted" });
  }
}

async function addTagToItem(watchItemId: string, tagName: string, userId: string) {
  // Get or create the tag
  const tag = await db.select({ id: schema.watchTags.id }).from(schema.watchTags).where(eq(schema.watchTags.name, tagName.trim())).limit(1);

  let tagId: string;
  if (tag.length === 0) {
    // Create new tag
    const [newTag] = await db
      .insert(schema.watchTags)
      .values({
        name: tagName.trim(),
        createdById: userId,
        updatedById: userId,
      })
      .returning({ id: schema.watchTags.id });
    tagId = newTag.id;
  } else {
    tagId = tag[0].id;
  }

  // Check if link already exists
  const existingLink = await db
    .select()
    .from(schema.watchItemTags)
    .where(and(eq(schema.watchItemTags.watchItemId, watchItemId), eq(schema.watchItemTags.watchTagId, tagId)))
    .limit(1);

  if (existingLink.length === 0) {
    // Create the link
    await db.insert(schema.watchItemTags).values({
      watchItemId,
      watchTagId: tagId,
      createdById: userId,
      updatedById: userId,
    });
  }
}
