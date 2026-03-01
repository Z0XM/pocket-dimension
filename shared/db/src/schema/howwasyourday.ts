import { boolean, index, integer, json, pgSchema, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import * as auth from "./auth";
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

export const pushSubscription = howWasYourDaySchema.table(
  "push_subscription",
  {
    id,
    ...timestamps,
    userId: uuid("user_id")
      .notNull()
      .references(() => auth.user.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    authKey: text("auth_key").notNull(),
    timezone: text("timezone").notNull(),
    reminderTime: text("reminder_time").default("21:00").notNull(),
    active: boolean("active").default(true).notNull(),
    lastNotifiedAt: timestamp("last_notified_at"),
  },
  (table) => [index("push_sub_user_id_idx").on(table.userId), index("push_sub_timezone_idx").on(table.timezone)]
);
