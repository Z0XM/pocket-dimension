import { readAsCsv } from "@common/csv";
import { csvOutputToJson } from "@common/json";
import type { schema } from "@pocket-dimension/db";

const csv = await readAsCsv("data/watchlist/cinema.csv");
const json = csvOutputToJson(csv, {
  arrayFields: ["tags"],
  emptyAsNull: true,
  lowercaseFields: true,
  ignoreFields: ["avgrating"],
}) as {
  index: string;
  title: string;
  tags: string[];
  type: string;
  language: string;
  seasons: string;
  z0xm: string;
  imtiyaz: string;
  lights: string;
  legend: string;
  deadpool: string;
}[];

const onlyUsers = ["z0xm"];

const watchItems: (typeof schema.watchItems.$inferInsert)[] = [];

const watchTags: (typeof schema.watchTags.$inferInsert)[] = [];
const watchItemTags: (typeof schema.watchItemTags.$inferInsert)[] = [];

const watchLanguages: (typeof schema.watchLanguages.$inferInsert)[] = [];
const watchItemRatings: (typeof schema.watchItemRatings.$inferInsert)[] = [];

Array.from(new Set(json.map((item) => item.language))).forEach((language) => {
  watchLanguages.push({
    language,
    createdById: onlyUsers.find((user) => user === language)!,
  });
});

// export const watchLanguages = Array.from(new Set(json.map((item) => item.language)));

// export const watchTags = Array.from(new Set(json.flatMap((item) => item.tags)));

// export const watchTypes = Array.from(new Set(json.flatMap((item) => item.type)));

// const data = {
//   watchLanguages,
//   watchTags,
//   watchTypes,
// }
// console.log(data);
