import { text, timestamp } from "drizzle-orm/pg-core";
import * as auth from "./auth";

export const timestamps = {
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at")
    .$onUpdate(() => new Date())
    .notNull(),
};

export const actionsByUser = {
  createdById: text("created_by_id")
    .notNull()
    .references(() => auth.user.id, { onDelete: "cascade" }),
  updatedById: text("updated_by_id").references(() => auth.user.id, { onDelete: "cascade" }),
};

export const id = text("id").primaryKey();
