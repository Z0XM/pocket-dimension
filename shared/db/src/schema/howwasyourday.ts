import { boolean, customType, index, integer, json, jsonb, numeric, pgSchema, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import * as auth from "./auth";
import { actionsByUser, id, timestamps } from "./common";

export const howWasYourDaySchema = pgSchema("howwasyourday");

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

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

/** Frozen 2025 year-recap dashboards (legacy import). Private payload + email. */
export const legacyRecapProfile = howWasYourDaySchema.table(
  "legacy_recap_profile",
  {
    id,
    ...timestamps,
    year: integer("year").notNull().default(2025),
    slug: text("slug").notNull(),
    legacyUserId: uuid("legacy_user_id").notNull(),
    displayName: text("display_name").notNull(),
    accentColor: text("accent_color").notNull().default("#214247"),
    rank: integer("rank").notNull(),
    daysFilled: integer("days_filled").notNull().default(0),
    drawingsCount: integer("drawings_count").notNull().default(0),
    monthsFilled: integer("months_filled").notNull().default(0),
    avgScore: numeric("avg_score", { precision: 6, scale: 2 }),
    firstDate: text("first_date"),
    lastDate: text("last_date"),
    /** Private — OTP only; never expose to clients except censored. */
    email: text("email").notNull(),
    /** Full UserRecap JSON; drawing_src replaced by drawing id URLs or null. */
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  },
  (table) => [
    unique("legacy_recap_profile_slug_year").on(table.slug, table.year),
    unique("legacy_recap_profile_legacy_user_year").on(table.legacyUserId, table.year),
    index("legacy_recap_profile_year_rank_idx").on(table.year, table.rank),
  ]
);

export const legacyRecapDrawing = howWasYourDaySchema.table(
  "legacy_recap_drawing",
  {
    id,
    ...timestamps,
    profileId: uuid("profile_id")
      .notNull()
      .references(() => legacyRecapProfile.id, { onDelete: "cascade" }),
    dayInt: integer("day_int").notNull(),
    png: bytea("png").notNull(),
    contentType: text("content_type").notNull().default("image/png"),
  },
  (table) => [
    unique("legacy_recap_drawing_profile_day").on(table.profileId, table.dayInt),
    index("legacy_recap_drawing_profile_idx").on(table.profileId),
  ]
);

export const legacyRecapOtp = howWasYourDaySchema.table(
  "legacy_recap_otp",
  {
    id,
    ...timestamps,
    profileId: uuid("profile_id")
      .notNull()
      .references(() => legacyRecapProfile.id, { onDelete: "cascade" }),
    codeHash: text("code_hash").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    attempts: integer("attempts").notNull().default(0),
  },
  (table) => [index("legacy_recap_otp_profile_idx").on(table.profileId)]
);

export const legacyRecapLink = howWasYourDaySchema.table(
  "legacy_recap_link",
  {
    id,
    ...timestamps,
    profileId: uuid("profile_id")
      .notNull()
      .references(() => legacyRecapProfile.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => auth.user.id, { onDelete: "cascade" }),
    linkedAt: timestamp("linked_at")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [unique("legacy_recap_link_profile").on(table.profileId), index("legacy_recap_link_user_idx").on(table.userId)]
);

/** Offline AI year summary (written by subagents; claim-gated on read). */
export const legacyRecapAiAnalysis = howWasYourDaySchema.table(
  "legacy_recap_ai_analysis",
  {
    id,
    ...timestamps,
    profileId: uuid("profile_id")
      .notNull()
      .references(() => legacyRecapProfile.id, { onDelete: "cascade" }),
    year: integer("year").notNull().default(2025),
    modelLabel: text("model_label").notNull().default("cursor-subagent"),
    promptVersion: text("prompt_version").notNull().default("v1"),
    inputFingerprint: text("input_fingerprint").notNull(),
    analysis: jsonb("analysis").$type<Record<string, unknown>>().notNull(),
    status: text("status").notNull().default("ready"),
    error: text("error"),
  },
  (table) => [unique("legacy_recap_ai_analysis_profile").on(table.profileId), index("legacy_recap_ai_analysis_year_idx").on(table.year)]
);
