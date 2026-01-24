import { db, schema } from "@pocket-dimension/db";
import { inArray } from "drizzle-orm";
import { getAdminUser, parseWatchlistRatingsCsv } from "./base";

const watchlistJson = await parseWatchlistRatingsCsv();
const adminUser = await getAdminUser();

const existingWatchItems = await db.query.watchItems.findMany({
  columns: {
    id: true,
    title: true,
  },
});

const existingWatchItemsMap = new Map(existingWatchItems.map((item) => [item.title, item.id]));

const watchItemRatings: (typeof schema.watchItemRatings.$inferInsert)[] = [];

const usernames = ["deadpool"];
const userColumnMap: Record<string, string> = {
  deadpool: "deadpool",
};

const users = await db.query.user.findMany({
  columns: {
    id: true,
    username: true,
  },
  where: inArray(schema.user.username, usernames),
});

watchlistJson.forEach((item) => {
  users.forEach((user) => {
    const userColumn = userColumnMap[user.username!];
    if (!userColumn) {
      throw new Error(`User column not found for ${user.username}`);
    }
    const watchItemId = existingWatchItemsMap.get(item.title);
    if (!watchItemId) {
      throw new Error(`Watch item ${item.title} not found`);
    }

    const rating = item[userColumn as keyof typeof item];
    let infinity = false;
    let shitty = false;
    let ratingExists = false;
    let ratingValue = null;
    if (rating === "♾️") {
      infinity = true;
    } else if (rating === "💩") {
      shitty = true;
    } else if (rating !== "" && rating !== null && rating !== undefined) {
      ratingValue = parseFloat(rating);
      ratingExists = true;
    } else {
      return;
    }

    watchItemRatings.push({
      watchItemId,
      userId: user.id,
      rating: ratingExists ? ratingValue?.toString() : null,
      infinity: infinity,
      shitty: shitty,
      createdById: adminUser.id,
      updatedById: adminUser.id,
    });
  });
});

const result = await db.insert(schema.watchItemRatings).values(watchItemRatings);
console.log("Watch item ratings inserted successfully", result.rowCount);
