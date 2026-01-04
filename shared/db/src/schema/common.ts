import { sql } from "drizzle-orm";
import { timestamp, uuid } from "drizzle-orm/pg-core";
import * as auth from "./auth";

export const timestamps = {
  createdAt: timestamp("created_at")
    .$default(() => sql`now()`)
    .notNull(),
  updatedAt: timestamp("updated_at")
    .$onUpdate(() => sql`now()`)
    .notNull(),
};

export const actionsByUser = {
  createdById: uuid("created_by_id")
    .notNull()
    .references(() => auth.user.id, { onDelete: "cascade" }),
  updatedById: uuid("updated_by_id").references(() => auth.user.id, { onDelete: "cascade" }),
};

export const id = uuid("id").primaryKey().default(sql`uuidv7()`).notNull();
