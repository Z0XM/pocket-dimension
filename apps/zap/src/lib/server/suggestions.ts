import { db, schema } from "@pocket-dimension/db";
import { and, asc, desc, eq, isNotNull, ne } from "drizzle-orm";
import { serializeCatalogueAsset } from "$lib/server/catalogue";

/** Tracks recently added by other users — simple social suggestion signal. */
export async function listSuggestionsFromOthers(userId: string, limit = 12) {
  const rows = await db
    .select()
    .from(schema.mediaAssets)
    .where(
      and(
        eq(schema.mediaAssets.status, "ready"),
        isNotNull(schema.mediaAssets.storageKey),
        isNotNull(schema.mediaAssets.addedByUserId),
        ne(schema.mediaAssets.addedByUserId, userId)
      )
    )
    .orderBy(desc(schema.mediaAssets.createdAt), asc(schema.mediaAssets.id))
    .limit(Math.min(Math.max(limit, 1), 40));

  return rows.map((asset) => serializeCatalogueAsset(asset, []));
}
