import { boolean, index, integer, pgSchema, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import * as auth from "./auth";
import { id, timestamps } from "./common";

export const zapSchema = pgSchema("zap");

/** `unavailable`: identity known (e.g. deleted/private YouTube item) but no audio source yet; backfill flips it to `ready`. */
export const mediaAssetStatus = zapSchema.enum("media_asset_status", ["pending", "ready", "failed", "unavailable"]);
export const mediaSourceType = zapSchema.enum("media_source_type", ["upload", "youtube", "url", "other"]);
export const tagKind = zapSchema.enum("tag_kind", ["system", "custom"]);
export const sessionStatus = zapSchema.enum("session_status", ["live", "ended"]);
export const sessionPlaybackState = zapSchema.enum("session_playback_state", ["idle", "playing", "paused"]);
export const sessionMemberRole = zapSchema.enum("session_member_role", ["host", "guest"]);
export const fetchJobStatus = zapSchema.enum("fetch_job_status", ["pending", "running", "ready", "failed"]);
export const syncRunStatus = zapSchema.enum("sync_run_status", ["pending", "running", "completed", "failed"]);
export const sessionSinkType = zapSchema.enum("session_sink_type", ["web", "discord"]);
export const sessionSinkStatus = zapSchema.enum("session_sink_status", ["pending", "active", "error", "detached"]);
export const playlistVisibility = zapSchema.enum("playlist_visibility", ["private", "public"]);
export const playlistMemberRole = zapSchema.enum("playlist_member_role", ["owner", "collaborator"]);

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
    /** YouTube / source description (nullable; not required for uploads). */
    description: text("description"),
    /** Channel / uploader display name (YouTube channelTitle). */
    channelTitle: text("channel_title"),
    /** YouTube channel id (UC…) when known. */
    channelId: text("channel_id"),
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
    /** When queue ends, algorithmically enqueue+play another catalogue track. */
    autoPlay: boolean("auto_play").default(true).notNull(),
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
    /** Saved to the catalogue as `unavailable` (metadata only, no audio). Not included in importedCount. */
    unavailableCount: integer("unavailable_count").default(0).notNull(),
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

/** Output sinks for a session (web is implicit; Discord is attachable). */
export const sessionSinks = zapSchema.table(
  "session_sinks",
  {
    id,
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    type: sessionSinkType("type").notNull(),
    status: sessionSinkStatus("status").default("pending").notNull(),
    /** Discord guild snowflake (or other sink-specific id). */
    externalGuildId: text("external_guild_id"),
    /** Discord voice channel snowflake. */
    externalChannelId: text("external_channel_id"),
    configJson: text("config_json"),
    errorMessage: text("error_message"),
    attachedByUserId: uuid("attached_by_user_id").references(() => auth.user.id, { onDelete: "set null" }),
    createdAt: timestamps.createdAt,
    updatedAt: timestamp("updated_at")
      .$default(() => sql`now()`)
      .$onUpdate(() => sql`now()`)
      .notNull(),
    detachedAt: timestamp("detached_at"),
  },
  (table) => [
    index("session_sinks_session_id_idx").on(table.sessionId),
    index("session_sinks_type_idx").on(table.type),
    uniqueIndex("session_sinks_one_active_discord")
      .on(table.sessionId, table.type)
      .where(sql`${table.type} = 'discord' AND ${table.detachedAt} IS NULL`),
  ]
);

/**
 * Per-user catalogue order (playlist import order, manual placement later).
 * Lower sortKey = earlier in “Your library” when ordered by library.
 */
export const userLibraryEntries = zapSchema.table(
  "user_library_entries",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => auth.user.id, { onDelete: "cascade" }),
    mediaAssetId: uuid("media_asset_id")
      .notNull()
      .references(() => mediaAssets.id, { onDelete: "cascade" }),
    sortKey: integer("sort_key").notNull().default(0),
    sourceSyncRunId: uuid("source_sync_run_id").references(() => syncRuns.id, { onDelete: "set null" }),
    createdAt: timestamps.createdAt,
    updatedAt: timestamp("updated_at")
      .$default(() => sql`now()`)
      .$onUpdate(() => sql`now()`)
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.mediaAssetId] }),
    index("user_library_entries_user_sort_idx").on(table.userId, table.sortKey),
  ]
);

/** Recorded plays for play-history UI. */
export const playEvents = zapSchema.table(
  "play_events",
  {
    id,
    userId: uuid("user_id")
      .notNull()
      .references(() => auth.user.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id").references(() => sessions.id, { onDelete: "set null" }),
    mediaAssetId: uuid("media_asset_id")
      .notNull()
      .references(() => mediaAssets.id, { onDelete: "cascade" }),
    playedAt: timestamp("played_at")
      .$default(() => sql`now()`)
      .notNull(),
  },
  (table) => [
    index("play_events_user_id_played_at_idx").on(table.userId, table.playedAt),
    index("play_events_media_asset_id_idx").on(table.mediaAssetId),
  ]
);

/** Saved session queues for replay in another session. */
export const savedQueues = zapSchema.table(
  "saved_queues",
  {
    id,
    userId: uuid("user_id")
      .notNull()
      .references(() => auth.user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sourceSessionId: uuid("source_session_id").references(() => sessions.id, { onDelete: "set null" }),
    createdAt: timestamps.createdAt,
  },
  (table) => [index("saved_queues_user_id_idx").on(table.userId)]
);

export const savedQueueItems = zapSchema.table(
  "saved_queue_items",
  {
    id,
    savedQueueId: uuid("saved_queue_id")
      .notNull()
      .references(() => savedQueues.id, { onDelete: "cascade" }),
    mediaAssetId: uuid("media_asset_id")
      .notNull()
      .references(() => mediaAssets.id, { onDelete: "restrict" }),
    position: integer("position").notNull(),
  },
  (table) => [
    uniqueIndex("saved_queue_items_queue_position_unique").on(table.savedQueueId, table.position),
    index("saved_queue_items_saved_queue_id_idx").on(table.savedQueueId),
  ]
);

/** Zap-native playlists (owned, optionally collaborative / public). */
export const playlists = zapSchema.table(
  "playlists",
  {
    id,
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => auth.user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    visibility: playlistVisibility("visibility").default("private").notNull(),
    createdAt: timestamps.createdAt,
    updatedAt: timestamp("updated_at")
      .$default(() => sql`now()`)
      .$onUpdate(() => sql`now()`)
      .notNull(),
  },
  (table) => [index("playlists_owner_user_id_idx").on(table.ownerUserId), index("playlists_visibility_idx").on(table.visibility)]
);

export const playlistItems = zapSchema.table(
  "playlist_items",
  {
    id,
    playlistId: uuid("playlist_id")
      .notNull()
      .references(() => playlists.id, { onDelete: "cascade" }),
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
    uniqueIndex("playlist_items_playlist_position_unique").on(table.playlistId, table.position),
    uniqueIndex("playlist_items_playlist_asset_unique").on(table.playlistId, table.mediaAssetId),
    index("playlist_items_playlist_id_idx").on(table.playlistId),
    index("playlist_items_media_asset_id_idx").on(table.mediaAssetId),
  ]
);

/** Tracks excluded when rebuilding a playlist from tags. */
export const playlistExclusions = zapSchema.table(
  "playlist_exclusions",
  {
    playlistId: uuid("playlist_id")
      .notNull()
      .references(() => playlists.id, { onDelete: "cascade" }),
    mediaAssetId: uuid("media_asset_id")
      .notNull()
      .references(() => mediaAssets.id, { onDelete: "cascade" }),
    createdAt: timestamps.createdAt,
  },
  (table) => [primaryKey({ columns: [table.playlistId, table.mediaAssetId] }), index("playlist_exclusions_playlist_id_idx").on(table.playlistId)]
);

export const playlistMembers = zapSchema.table(
  "playlist_members",
  {
    id,
    playlistId: uuid("playlist_id")
      .notNull()
      .references(() => playlists.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => auth.user.id, { onDelete: "cascade" }),
    role: playlistMemberRole("role").notNull(),
    createdAt: timestamps.createdAt,
  },
  (table) => [
    uniqueIndex("playlist_members_playlist_user_unique").on(table.playlistId, table.userId),
    index("playlist_members_user_id_idx").on(table.userId),
  ]
);
