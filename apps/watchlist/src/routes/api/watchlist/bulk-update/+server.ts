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
  rating?: number | null;
  infinity?: boolean;
  shitty?: boolean;
  progressStatus?: string | null;
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
  // Check if item exists first
  const existingItem = await db.select({ id: schema.watchItems.id }).from(schema.watchItems).where(eq(schema.watchItems.id, update.id)).limit(1);

  if (existingItem.length === 0) {
    errors.push({ id: update.id, message: "Item not found" });
    return;
  }

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
    const result = await db.update(schema.watchItems).set(watchItemUpdates).where(eq(schema.watchItems.id, update.id));

    // Only mark as updated if the update actually affected rows
    if (result.rowCount === 0) {
      errors.push({ id: update.id, message: "Failed to update item" });
      return;
    }
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

    // Determine the effective progress status (updated value or existing value)
    let effectiveProgressStatus: string | null = null;
    if (update.progressStatus !== undefined) {
      // Validate progressStatus is one of the valid enum values
      const validStatuses = ["watch_later", "watching", "watched", "dropped"] as const;
      if (update.progressStatus && !validStatuses.includes(update.progressStatus as (typeof validStatuses)[number])) {
        errors.push({ id: update.id, field: "progressStatus", message: "Invalid progress status" });
        return;
      }
      effectiveProgressStatus = update.progressStatus as (typeof validStatuses)[number] | null;
    } else if (existingRating.length > 0) {
      // Use existing progress status if not being updated
      effectiveProgressStatus = existingRating[0].progressStatus;
    }

    // Ratings are only allowed when progress is "watched" or "dropped"
    const canHaveRating = effectiveProgressStatus === "watched" || effectiveProgressStatus === "dropped";

    // Validate: if rating fields are provided but progress is not "watched" or "dropped", reject them
    // Exception: if progress is being updated to something other than "watched" or "dropped", we'll clear ratings instead of rejecting
    if (
      !canHaveRating &&
      update.progressStatus === undefined &&
      (update.rating !== undefined || update.infinity !== undefined || update.shitty !== undefined)
    ) {
      errors.push({
        id: update.id,
        field: "my_rating",
        message: "Ratings are only allowed when progress is 'Watched' or 'Dropped'",
      });
      return;
    }

    const ratingData: Partial<typeof schema.watchItemRatings.$inferInsert> = {
      updatedById: user.id,
    };

    if (update.progressStatus !== undefined) {
      ratingData.progressStatus = effectiveProgressStatus;

      // If progress is being set to something other than "watched" or "dropped", always clear rating fields
      if (!canHaveRating) {
        ratingData.rating = null;
        ratingData.infinity = false;
        ratingData.shitty = false;
      } else {
        // Progress is "watched" or "dropped" - allow rating fields to be updated
        if (update.rating !== undefined) {
          ratingData.rating = update.rating?.toString() ?? null;
        }
        if (update.infinity !== undefined) {
          ratingData.infinity = update.infinity;
        }
        if (update.shitty !== undefined) {
          ratingData.shitty = update.shitty;
        }
      }
    } else {
      // Progress not being updated - only allow rating fields if current progress is "watched" or "dropped"
      if (canHaveRating) {
        if (update.rating !== undefined) {
          ratingData.rating = update.rating?.toString() ?? null;
        }
        if (update.infinity !== undefined) {
          ratingData.infinity = update.infinity;
        }
        if (update.shitty !== undefined) {
          ratingData.shitty = update.shitty;
        }
      }
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
    // Deduplicate removeTags (case-insensitive)
    const uniqueRemoveTags = Array.from(new Map(update.removeTags.map((tag) => [tag.trim().toLowerCase(), tag.trim()])).values());

    // Get tag IDs for the tag names
    const tagsToRemove = await db.select({ id: schema.watchTags.id }).from(schema.watchTags).where(inArray(schema.watchTags.name, uniqueRemoveTags));

    if (tagsToRemove.length > 0) {
      const tagIds = tagsToRemove.map((t) => t.id);
      await db
        .delete(schema.watchItemTags)
        .where(and(eq(schema.watchItemTags.watchItemId, update.id), inArray(schema.watchItemTags.watchTagId, tagIds)));
    }
  }

  // Handle tag additions
  if (update.addTags && update.addTags.length > 0) {
    // Deduplicate addTags (case-insensitive) and filter out empty tags
    const uniqueAddTags = Array.from(
      new Map(
        update.addTags
          .map((tag) => tag?.trim())
          .filter((tag): tag is string => !!tag && tag.length > 0)
          .map((tag) => [tag.toLowerCase(), tag])
      ).values()
    );

    // Check for conflicts: tags that are both being added and removed
    const removeTagsLower = (update.removeTags || []).map((tag) => tag.trim().toLowerCase());
    const conflictingTags = uniqueAddTags.filter((tag) => removeTagsLower.includes(tag.toLowerCase()));

    if (conflictingTags.length > 0) {
      errors.push({
        id: update.id,
        field: "tags",
        message: `Cannot add and remove the same tags: ${conflictingTags.join(", ")}`,
      });
    }

    // Filter out conflicting tags from additions
    const tagsToAdd = uniqueAddTags.filter((tag) => !conflictingTags.includes(tag));

    for (const tagName of tagsToAdd) {
      await addTagToItem(update.id, tagName, user.id);
    }
  }

  // Only mark as updated if at least one operation was performed
  if (
    hasWatchItemUpdates ||
    hasRatingUpdates ||
    (update.removeTags && update.removeTags.length > 0) ||
    (update.addTags && update.addTags.length > 0)
  ) {
    results.updated.push(update.id);
  }
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

  // Check title uniqueness (within transaction would be better, but this is a check)
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
  let created: { id: string } | undefined;
  try {
    [created] = await db
      .insert(schema.watchItems)
      .values({
        title: newItem.title.trim(),
        languageId: newItem.languageId,
        type: newItem.type as "movie" | "series" | "shorts",
        createdById: user.id,
        updatedById: user.id,
      })
      .returning({ id: schema.watchItems.id });
  } catch (error) {
    // Handle unique constraint violation (race condition)
    if (error instanceof Error && (error.message.includes("unique") || error.message.includes("duplicate"))) {
      errors.push({ id: newItem.tempId, field: "title", message: "A watch item with this title already exists" });
      return;
    }
    throw error; // Re-throw if it's a different error
  }

  if (!created) {
    errors.push({ id: newItem.tempId, message: "Failed to create item" });
    return;
  }

  // Add tags if any
  if (newItem.tags && newItem.tags.length > 0) {
    // Deduplicate tags (case-insensitive) and filter out empty tags
    const uniqueTags = Array.from(
      new Map(
        newItem.tags
          .map((tag) => tag?.trim())
          .filter((tag): tag is string => !!tag && tag.length > 0)
          .map((tag) => [tag.toLowerCase(), tag])
      ).values()
    );

    for (const tagName of uniqueTags) {
      await addTagToItem(created.id, tagName, user.id);
    }
  }

  // Handle rating fields for new items
  const hasRatingFields =
    newItem.rating !== undefined || newItem.infinity !== undefined || newItem.shitty !== undefined || newItem.progressStatus !== undefined;

  if (hasRatingFields) {
    // Validate progressStatus if provided
    let effectiveProgressStatus: string | null = null;
    if (newItem.progressStatus !== undefined) {
      const validStatuses = ["watch_later", "watching", "watched", "dropped"] as const;
      if (newItem.progressStatus && !validStatuses.includes(newItem.progressStatus as (typeof validStatuses)[number])) {
        errors.push({
          id: newItem.tempId,
          field: "progressStatus",
          message: "Invalid progress status",
        });
        return;
      }
      effectiveProgressStatus = newItem.progressStatus as (typeof validStatuses)[number] | null;
    }

    // Ratings are only allowed when progress is "watched" or "dropped"
    const canHaveRating = effectiveProgressStatus === "watched" || effectiveProgressStatus === "dropped";

    // Validate: if rating fields are provided but progress is not "watched" or "dropped", reject them
    if (!canHaveRating && (newItem.rating !== undefined || newItem.infinity !== undefined || newItem.shitty !== undefined)) {
      errors.push({
        id: newItem.tempId,
        field: "my_rating",
        message: "Ratings are only allowed when progress is 'Watched' or 'Dropped'",
      });
      return;
    }

    const ratingData: typeof schema.watchItemRatings.$inferInsert = {
      watchItemId: created.id,
      userId: user.id,
      createdById: user.id,
      updatedById: user.id,
      // Only set rating fields if progress is "watched" or "dropped"
      rating: canHaveRating && newItem.rating !== undefined ? (newItem.rating?.toString() ?? null) : null,
      infinity: canHaveRating && newItem.infinity !== undefined ? (newItem.infinity ?? false) : false,
      shitty: canHaveRating && newItem.shitty !== undefined ? (newItem.shitty ?? false) : false,
      progressStatus: effectiveProgressStatus,
    };

    // Create rating record for the new item
    await db.insert(schema.watchItemRatings).values(ratingData);
  }

  results.created.push({ tempId: newItem.tempId, newId: created.id });
}

async function processDelete(deleteId: string, _user: NonNullable<App.Locals["user"]>, errors: BulkUpdateError[], results: { deleted: string[] }) {
  // Delete the watch item (cascades to ratings and tags due to ON DELETE CASCADE)
  const deleted = await db.delete(schema.watchItems).where(eq(schema.watchItems.id, deleteId)).returning({ id: schema.watchItems.id });

  if (deleted.length > 0) {
    results.deleted.push(deleteId);
  } else {
    errors.push({ id: deleteId, message: "Item not found or already deleted" });
  }
}

async function addTagToItem(watchItemId: string, tagName: string, userId: string) {
  // Validate tag name
  const trimmedTagName = tagName.trim();
  if (!trimmedTagName) {
    throw new Error("Tag name cannot be empty");
  }

  // Get or create the tag
  const tag = await db.select({ id: schema.watchTags.id }).from(schema.watchTags).where(eq(schema.watchTags.name, trimmedTagName)).limit(1);

  let tagId: string;
  if (tag.length === 0) {
    // Create new tag
    const [newTag] = await db
      .insert(schema.watchTags)
      .values({
        name: trimmedTagName,
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
