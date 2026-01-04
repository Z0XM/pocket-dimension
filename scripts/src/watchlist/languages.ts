import { db, schema } from "@pocket-dimension/db";
import { getAdminUser, parseWatchlistCsv } from "./base";

const watchlistJson = await parseWatchlistCsv();
const adminUser = await getAdminUser();

const watchLanguages: (typeof schema.watchLanguages.$inferInsert)[] = [];

Array.from(new Set(watchlistJson.map((item) => item.language))).forEach((language) => {
  watchLanguages.push({
    language,
    createdById: adminUser.id,
    updatedById: adminUser.id,
  });
});

console.log("Languages parsed successfully", watchLanguages.length);

const result = await db.insert(schema.watchLanguages).values(watchLanguages);
console.log("Languages inserted successfully", result.rowCount);
