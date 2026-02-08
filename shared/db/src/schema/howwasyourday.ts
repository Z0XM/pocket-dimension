import { integer, json, pgSchema, unique, uuid } from "drizzle-orm/pg-core";
import { actionsByUser, id, timestamps } from "./common";

export const howWasYourDaySchema = pgSchema("howwasyourday");

export const dayData = howWasYourDaySchema.table(
  "day_data",
  {
    id,
    ...timestamps,
    ...actionsByUser,
    metadata: json().notNull(),
    day_int: integer().notNull(),
    user_id: uuid().notNull(),
  },
  (table) => [unique("day_data_user_id_day_int").on(table.user_id, table.day_int)]
);
