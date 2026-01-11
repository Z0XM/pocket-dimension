import { db, schema } from "@pocket-dimension/db";
import { v7 as uuidv7 } from "uuid";
import { getAdminUser, parseWatchlistCsv } from "./base";

const watchlistJson = (await parseWatchlistCsv()).sort((a, b) => {
  const aIndex = parseInt(a.index, 10);
  const bIndex = parseInt(b.index, 10);
  return aIndex - bIndex;
});

const adminUser = await getAdminUser();

const watchItems: (typeof schema.watchItems.$inferInsert)[] = [];
const watchItemTags: (typeof schema.watchItemTags.$inferInsert)[] = [];

const existingLanguages = await db.query.watchLanguages.findMany({
  columns: {
    id: true,
    language: true,
  },
});
const existingLanguagesMap = new Map(existingLanguages.map((language) => [language.language, language.id]));

const existingTags = await db.query.watchTags.findMany({
  columns: {
    id: true,
    name: true,
  },
});
const existingTagsMap = new Map(existingTags.map((tag) => [tag.name, tag.id]));

watchlistJson.forEach((item) => {
  const watchItemId = uuidv7();
  const languageId = existingLanguagesMap.get(item.language);
  if (!languageId) {
    throw new Error(`Language ${item.language} not found`);
  }

  item.tags.forEach((tag) => {
    const tagId = existingTagsMap.get(tag);
    if (!tagId) {
      throw new Error(`Tag ${tag} not found`);
    }
    watchItemTags.push({
      createdById: adminUser.id,
      updatedById: adminUser.id,
      watchTagId: tagId,
      watchItemId,
    });
  });

  const animatedTagId = existingTagsMap.get("Animated");
  if (!animatedTagId) {
    throw new Error("Animated tag not found");
  }

  if (item.type.includes("Animated")) {
    watchItemTags.push({
      createdById: adminUser.id,
      updatedById: adminUser.id,
      watchTagId: animatedTagId,
      watchItemId,
    });
  }

  watchItems.push({
    id: watchItemId,
    title: item.title,
    type: item.type.includes("Movie") ? "movie" : item.type.includes("Series") ? "series" : "shorts",
    languageId,
    seasons: item.seasons ? parseInt(item.seasons, 10) : null,
    createdById: adminUser.id,
    updatedById: adminUser.id,
  });
});

// Bun.write("watchlist-items.json", JSON.stringify(watchItems, null, 2));
// Bun.write("watchlist-item-tags.json", JSON.stringify(watchItemTags, null, 2));

await db.transaction(async (tx) => {
  const insertedWatchItems = await tx.insert(schema.watchItems).values(watchItems);
  console.log(`Inserted ${insertedWatchItems.rowCount} watch items`);

  const insertedWatchItemTags = await tx.insert(schema.watchItemTags).values(watchItemTags);

  console.log(`Inserted ${insertedWatchItemTags.rowCount} watch item tags`);
});
