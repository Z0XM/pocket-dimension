import { boolean, index, integer, pgSchema, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import * as auth from "./auth";
import { id, timestamps } from "./common";

export const zapSchema = pgSchema("zap");

export const mediaAssetStatus = zapSchema.enum("media_asset_status", ["pending", "ready", "failed"]);
export const mediaSourceType = zapSchema.enum("media_source_type", ["upload", "youtube", "url", "other"]);
export const tagKind = zapSchema.enum("tag_kind", ["system", "custom"]);
export const sessionStatus = zapSchema.enum("session_status", ["live", "ended"]);
export const sessionPlaybackState = zapSchema.enum("session_playback_state", ["idle", "playing", "paused"]);
export const sessionMemberRole = zapSchema.enum("session_member_role", ["host", "guest"]);
export const fetchJobStatus = zapSchema.enum("fetch_job_status", ["pending", "running", "ready", "failed"]);
export const syncRunStatus = zapSchema.enum("sync_run_status", ["pending", "running", "completed", "failed"]);

/** Global Zap catalogue — never deleted by app logic. */
export const mediaAssets = zapSchema.table(
  "media_assets",
  {
    id,
    identityKey: text("identity_key").notNull(),
    sourceType: mediaSourceType("source_type").notNull(),
    status: mediaAssetStatus("status").default("pending").notNull(),
    storageKey: text("storage_key"),
    title: text("title").notNull(),
    artists: text("artists"),
    durationMs: integer("duration_ms"),
    codec: text("codec"),
    externalUrl: text("external_url"),
    errorMessage: text("error_message"),
    addedByUserId: uuid("added_by_user_id").references(() => auth.user.id, { onDelete: "set null" }),
    createdAt: timestamps.createdAt,
    updatedAt: timestamp("updated_at")
      .$default(() => sql`now()`)
      .$onUpdate(() => sql`now()`)
      .notNull(),
  },
  (table) => [
    uniqueIndex("media_assets_identity_key_unique").on(table.identityKey),
    index("media_assets_status_idx").on(table.status),
    index("media_assets_added_by_user_id_idx").on(table.addedByUserId),
  ]
);

export const tags = zapSchema.table(
  "tags",
  {
    id,
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    kind: tagKind("kind").notNull(),
    ownerUserId: uuid("owner_user_id").references(() => auth.user.id, { onDelete: "cascade" }),
    createdAt: timestamps.createdAt,
  },
  (table) => [
    uniqueIndex("tags_system_slug_unique")
      .on(table.slug)
      .where(sql`${table.kind} = 'system'`),
    uniqueIndex("tags_custom_owner_slug_unique")
      .on(table.ownerUserId, table.slug)
      .where(sql`${table.kind} = 'custom'`),
    index("tags_owner_user_id_idx").on(table.ownerUserId),
  ]
);

/** Per-user tags on catalogue assets — drives “Your library”. */
export const mediaAssetTags = zapSchema.table(
  "media_asset_tags",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => auth.user.id, { onDelete: "cascade" }),
    mediaAssetId: uuid("media_asset_id")
      .notNull()
      .references(() => mediaAssets.id, { onDelete: "restrict" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at")
      .$default(() => sql`now()`)
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.mediaAssetId, table.tagId] }),
    index("media_asset_tags_user_id_idx").on(table.userId),
    index("media_asset_tags_media_asset_id_idx").on(table.mediaAssetId),
    index("media_asset_tags_tag_id_idx").on(table.tagId),
    index("media_asset_tags_user_asset_idx").on(table.userId, table.mediaAssetId),
  ]
);

/** Listening session — host transport authority; guests listen-only by default. */
export const sessions = zapSchema.table(
  "sessions",
  {
    id,
    hostUserId: uuid("host_user_id")
      .notNull()
      .references(() => auth.user.id, { onDelete: "cascade" }),
    joinCode: text("join_code").notNull(),
    status: sessionStatus("status").default("live").notNull(),
    playbackState: sessionPlaybackState("playback_state").default("idle").notNull(),
    currentQueueItemId: uuid("current_queue_item_id"),
    positionMs: integer("position_ms").default(0).notNull(),
    positionUpdatedAt: timestamp("position_updated_at")
      .$default(() => sql`now()`)
      .notNull(),
    playbackGeneration: integer("playback_generation").default(0).notNull(),
    guestsCanAdd: boolean("guests_can_add").default(false).notNull(),
    guestsCanControl: boolean("guests_can_control").default(false).notNull(),
    lastActivityAt: timestamp("last_activity_at")
      .$default(() => sql`now()`)
      .notNull(),
    createdAt: timestamps.createdAt,
    endedAt: timestamp("ended_at"),
  },
  (table) => [
    uniqueIndex("sessions_join_code_unique").on(table.joinCode),
    index("sessions_host_user_id_idx").on(table.hostUserId),
    index("sessions_status_idx").on(table.status),
    index("sessions_last_activity_at_idx").on(table.lastActivityAt),
  ]
);

export const sessionMembers = zapSchema.table(
  "session_members",
  {
    id,
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => auth.user.id, { onDelete: "cascade" }),
    role: sessionMemberRole("role").notNull(),
    joinedAt: timestamp("joined_at")
      .$default(() => sql`now()`)
      .notNull(),
    leftAt: timestamp("left_at"),
  },
  (table) => [
    uniqueIndex("session_members_active_unique")
      .on(table.sessionId, table.userId)
      .where(sql`${table.leftAt} IS NULL`),
    index("session_members_session_id_idx").on(table.sessionId),
    index("session_members_user_id_idx").on(table.userId),
  ]
);

export const queueItems = zapSchema.table(
  "queue_items",
  {
    id,
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    mediaAssetId: uuid("media_asset_id")
      .notNull()
      .references(() => mediaAssets.id, { onDelete: "restrict" }),
    position: integer("position").notNull(),
    addedByUserId: uuid("added_by_user_id")
      .notNull()
      .references(() => auth.user.id, { onDelete: "cascade" }),
    createdAt: timestamps.createdAt,
  },
  (table) => [
    uniqueIndex("queue_items_session_position_unique").on(table.sessionId, table.position),
    index("queue_items_session_id_idx").on(table.sessionId),
    index("queue_items_media_asset_id_idx").on(table.mediaAssetId),
    index("queue_items_added_by_user_id_idx").on(table.addedByUserId),
  ]
);

/** Single-flight ingest by identity_key (youtube:VIDEO_ID, etc.). */
export const fetchJobs = zapSchema.table(
  "fetch_jobs",
  {
    id,
    identityKey: text("identity_key").notNull(),
    status: fetchJobStatus("status").default("pending").notNull(),
    mediaAssetId: uuid("media_asset_id").references(() => mediaAssets.id, { onDelete: "set null" }),
    sourceUrl: text("source_url"),
    errorMessage: text("error_message"),
    createdAt: timestamps.createdAt,
    updatedAt: timestamp("updated_at")
      .$default(() => sql`now()`)
      .$onUpdate(() => sql`now()`)
      .notNull(),
  },
  (table) => [uniqueIndex("fetch_jobs_identity_key_unique").on(table.identityKey), index("fetch_jobs_status_idx").on(table.status)]
);

/** One Library “Add URL” / playlist sync attempt. */
export const syncRuns = zapSchema.table(
  "sync_runs",
  {
    id,
    userId: uuid("user_id")
      .notNull()
      .references(() => auth.user.id, { onDelete: "cascade" }),
    sourceUrl: text("source_url").notNull(),
    status: syncRunStatus("status").default("pending").notNull(),
    importedCount: integer("imported_count").default(0).notNull(),
    skippedCount: integer("skipped_count").default(0).notNull(),
    failedCount: integer("failed_count").default(0).notNull(),
    summaryJson: text("summary_json"),
    errorMessage: text("error_message"),
    createdAt: timestamps.createdAt,
    finishedAt: timestamp("finished_at"),
  },
  (table) => [index("sync_runs_user_id_idx").on(table.userId), index("sync_runs_status_idx").on(table.status)]
);

/**
 * Connected Google/YouTube account for playlist import (Phase 4).
 * Tokens AES-GCM encrypted at rest. Distinct export name from zeo.youtubeAccountLinks.
 */
export const zapYoutubeAccountLinks = zapSchema.table("youtube_account_links", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => auth.user.id, { onDelete: "cascade" }),
  googleSub: text("google_sub").notNull(),
  refreshTokenEnc: text("refresh_token_enc").notNull(),
  accessTokenEnc: text("access_token_enc").notNull(),
  accessExpiresAt: timestamp("access_expires_at").notNull(),
  scopes: text("scopes").array().notNull(),
  linkedAt: timestamp("linked_at")
    .$default(() => sql`now()`)
    .notNull(),
  revokedAt: timestamp("revoked_at"),
});
