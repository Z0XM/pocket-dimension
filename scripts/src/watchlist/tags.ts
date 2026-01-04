import { db, schema } from "@pocket-dimension/db";
import { getAdminUser, parseWatchlistCsv } from "./base";

const watchlistJson = await parseWatchlistCsv();
const adminUser = await getAdminUser();

const watchTags: (typeof schema.watchTags.$inferInsert)[] = [];

[...Array.from(new Set(watchlistJson.flatMap((item) => item.tags))), "Animated"].forEach((tag) => {
  watchTags.push({
    name: tag,
    createdById: adminUser.id,
    updatedById: adminUser.id,
  });
});

console.log("Tags parsed successfully", watchTags.length);

const result = await db.insert(schema.watchTags).values(watchTags);
console.log("Tags inserted successfully", result.rowCount);
