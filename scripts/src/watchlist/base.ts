import { readAsCsv } from "@common/csv";
import { csvOutputToJson } from "@common/json";
import { db, schema } from "@pocket-dimension/db";
import { and, eq } from "drizzle-orm";

export const parseWatchlistCsv = async () => {
  console.log("Parsing watchlist CSV");

  const csv = await readAsCsv("data/watchlist/cinema.csv");
  console.log("CSV read successfully", csv.rows.length);

  const json = csvOutputToJson(csv, {
    arrayFields: ["tags"],
    emptyAsNull: true,
    lowercaseFields: true,
    ignoreFields: ["avgrating", "z0xm", "imtiyaz", "lights", "legend", "deadpool"],
  }) as {
    index: string;
    title: string;
    tags: string[];
    type: string;
    language: string;
    seasons: string;
  }[];
  console.log("JSON parsed successfully", json.length);

  return json;
};

export const parseWatchlistRatingsCsv = async () => {
  console.log("Parsing watchlist CSV");

  const csv = await readAsCsv("data/watchlist/cinema.csv");
  console.log("CSV read successfully", csv.rows.length);

  const json = csvOutputToJson(csv, {
    emptyAsNull: true,
    lowercaseFields: true,
    ignoreFields: ["tags", "type", "language", "seasons", "index", "avgrating"],
  }) as {
    title: string;
    z0xm: string;
    imtiyaz: string;
    lights: string;
    legend: string;
    deadpool: string;
  }[];
  console.log("JSON parsed successfully", json.length);

  return json;
};

export const getAdminUser = async () => {
  const adminUser = await db.query.user.findFirst({
    where: eq(schema.user.role, "admin"),
    columns: {
      id: true,
      username: true,
      name: true,
    },
  });
  if (!adminUser) {
    throw new Error("Admin user not found");
  }
  console.log("Admin user found", adminUser);
  return adminUser;
};
