import { boolean, index, integer, jsonb, pgSchema, primaryKey, text, timestamp, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import * as auth from "./auth";
import { actionsByUser, id, timestamps } from "./common";

export const zeoSchema = pgSchema("zeo");

export const roomStatus = zeoSchema.enum("room_status", ["waiting", "active", "stale", "ended"]);
export const sessionBlockReason = zeoSchema.enum("session_block_reason", ["removed"]);
export const waitingEntryStatus = zeoSchema.enum("waiting_entry_status", ["pending", "admitted", "denied"]);
export const chatMessageKind = zeoSchema.enum("chat_message_kind", ["text", "snapshot"]);
export const gameType = zeoSchema.enum("game_type", ["charades"]);
export const gameSessionStatus = zeoSchema.enum("game_session_status", ["setup", "active", "ended"]);
export const gameRoundPhase = zeoSchema.enum("game_round_phase", [
  "submission",
  "passed_on",
  "act",
  "verdict",
  "ready_check",
  "completed",
]);
export const gameVerdict = zeoSchema.enum("game_verdict", ["accepted", "rejected"]);

export const rooms = zeoSchema.table(
  "rooms",
  {
    id,
    ...timestamps,
    ...actionsByUser,
    slug: text("slug").notNull(),
    livekitRoomName: text("livekit_room_name").notNull(),
    displayName: text("display_name").notNull(),
    hostUserId: uuid("host_user_id")
      .notNull()
      .references(() => auth.user.id, { onDelete: "cascade" }),
    status: roomStatus("status").default("waiting").notNull(),
    maxParticipants: integer("max_participants").default(6).notNull(),
    waitingRoomEnabled: boolean("waiting_room_enabled").default(false).notNull(),
    isPublic: boolean("is_public").default(false).notNull(),
    isPerpetual: boolean("is_perpetual").default(false).notNull(),
    isLocked: boolean("is_locked").default(false).notNull(),
    scheduledStartAt: timestamp("scheduled_start_at"),
    forceEndedById: uuid("force_ended_by_id").references(() => auth.user.id, { onDelete: "set null" }),
    endedAt: timestamp("ended_at"),
  },
  (table) => [
    unique("rooms_slug_unique").on(table.slug),
    unique("rooms_livekit_room_name_unique").on(table.livekitRoomName),
    index("rooms_host_user_id_idx").on(table.hostUserId),
    index("rooms_status_idx").on(table.status),
    index("rooms_is_public_status_idx").on(table.isPublic, table.status),
    index("rooms_scheduled_start_at_idx").on(table.scheduledStartAt),
  ]
);

export const roomParticipants = zeoSchema.table(
  "room_participants",
  {
    id,
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    participantIdentity: text("participant_identity").notNull(),
    userId: uuid("user_id").references(() => auth.user.id, { onDelete: "set null" }),
    guestDisplayName: text("guest_display_name"),
    isGuest: boolean("is_guest").default(false).notNull(),
    joinedAt: timestamp("joined_at")
      .$default(() => sql`now()`)
      .notNull(),
    leftAt: timestamp("left_at"),
    removedById: uuid("removed_by_id").references(() => auth.user.id, { onDelete: "set null" }),
  },
  (table) => [
    index("room_participants_room_id_idx").on(table.roomId),
    index("room_participants_user_id_idx").on(table.userId),
    index("room_participants_participant_identity_idx").on(table.participantIdentity),
  ]
);

export const roomSessionBlocks = zeoSchema.table(
  "room_session_blocks",
  {
    id,
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    participantIdentity: text("participant_identity").notNull(),
    blockedAt: timestamp("blocked_at")
      .$default(() => sql`now()`)
      .notNull(),
    blockedById: uuid("blocked_by_id")
      .notNull()
      .references(() => auth.user.id, { onDelete: "cascade" }),
    reason: sessionBlockReason("reason").default("removed").notNull(),
  },
  (table) => [
    unique("room_session_blocks_room_id_participant_identity_unique").on(table.roomId, table.participantIdentity),
    index("room_session_blocks_room_id_idx").on(table.roomId),
  ]
);

export const chatMessages = zeoSchema.table(
  "chat_messages",
  {
    id,
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    senderIdentity: text("sender_identity").notNull(),
    senderDisplayName: text("sender_display_name").notNull(),
    kind: chatMessageKind("kind").default("text").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at")
      .$default(() => sql`now()`)
      .notNull(),
  },
  (table) => [
    index("chat_messages_room_id_idx").on(table.roomId),
    index("chat_messages_room_id_created_at_idx").on(table.roomId, table.createdAt),
    index("chat_messages_room_id_kind_idx").on(table.roomId, table.kind),
  ]
);

export const roomWaitingEntries = zeoSchema.table(
  "room_waiting_entries",
  {
    id,
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    participantIdentity: text("participant_identity").notNull(),
    displayName: text("display_name").notNull(),
    status: waitingEntryStatus("status").default("pending").notNull(),
    requestedAt: timestamp("requested_at")
      .$default(() => sql`now()`)
      .notNull(),
    resolvedAt: timestamp("resolved_at"),
    resolvedById: uuid("resolved_by_id").references(() => auth.user.id, { onDelete: "set null" }),
  },
  (table) => [
    unique("room_waiting_entries_room_id_participant_identity_unique").on(table.roomId, table.participantIdentity),
    index("room_waiting_entries_room_id_status_idx").on(table.roomId, table.status),
  ]
);

export const gameSessions = zeoSchema.table(
  "game_sessions",
  {
    id,
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    hostUserId: uuid("host_user_id")
      .notNull()
      .references(() => auth.user.id, { onDelete: "cascade" }),
    gameType: gameType("game_type").notNull(),
    status: gameSessionStatus("status").default("setup").notNull(),
    teamCount: integer("team_count").notNull(),
    config: jsonb("config")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    createdAt: timestamp("created_at")
      .$default(() => sql`now()`)
      .notNull(),
    endedAt: timestamp("ended_at"),
  },
  (table) => [
    index("game_sessions_room_id_idx").on(table.roomId),
    index("game_sessions_status_idx").on(table.status),
    uniqueIndex("game_sessions_one_active_per_room").on(table.roomId).where(sql`${table.status} = 'active'`),
  ]
);

export const gameTeams = zeoSchema.table(
  "game_teams",
  {
    id,
    sessionId: uuid("session_id")
      .notNull()
      .references(() => gameSessions.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    colorKey: text("color_key").notNull(),
    sortOrder: integer("sort_order").notNull(),
    score: integer("score").default(0).notNull(),
  },
  (table) => [
    index("game_teams_session_id_idx").on(table.sessionId),
    unique("game_teams_session_id_sort_order_unique").on(table.sessionId, table.sortOrder),
  ]
);

export const gameParticipants = zeoSchema.table(
  "game_participants",
  {
    sessionId: uuid("session_id")
      .notNull()
      .references(() => gameSessions.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => auth.user.id, { onDelete: "cascade" }),
    teamId: uuid("team_id").references(() => gameTeams.id, { onDelete: "set null" }),
    isReady: boolean("is_ready").default(false).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.sessionId, table.userId] }),
    index("game_participants_session_id_idx").on(table.sessionId),
    index("game_participants_team_id_idx").on(table.teamId),
  ]
);

export const gameRounds = zeoSchema.table(
  "game_rounds",
  {
    id,
    sessionId: uuid("session_id")
      .notNull()
      .references(() => gameSessions.id, { onDelete: "cascade" }),
    roundNumber: integer("round_number").notNull(),
    proposingTeamId: uuid("proposing_team_id")
      .notNull()
      .references(() => gameTeams.id, { onDelete: "cascade" }),
    guessingTeamId: uuid("guessing_team_id")
      .notNull()
      .references(() => gameTeams.id, { onDelete: "cascade" }),
    mimeUserId: uuid("mime_user_id")
      .notNull()
      .references(() => auth.user.id, { onDelete: "cascade" }),
    phase: gameRoundPhase("phase").default("submission").notNull(),
    lockedWord: text("locked_word"),
    lockedSuggestionId: uuid("locked_suggestion_id"),
    verdict: gameVerdict("verdict"),
    resolvedByUserId: uuid("resolved_by_user_id").references(() => auth.user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at")
      .$default(() => sql`now()`)
      .notNull(),
  },
  (table) => [
    unique("game_rounds_session_id_round_number_unique").on(table.sessionId, table.roundNumber),
    index("game_rounds_session_id_idx").on(table.sessionId),
  ]
);

export const gameSuggestions = zeoSchema.table(
  "game_suggestions",
  {
    id,
    roundId: uuid("round_id")
      .notNull()
      .references(() => gameRounds.id, { onDelete: "cascade" }),
    suggesterUserId: uuid("suggester_user_id")
      .notNull()
      .references(() => auth.user.id, { onDelete: "cascade" }),
    word: text("word").notNull(),
    createdAt: timestamp("created_at")
      .$default(() => sql`now()`)
      .notNull(),
  },
  (table) => [index("game_suggestions_round_id_idx").on(table.roundId)]
);

export const gameSuggestionVotes = zeoSchema.table(
  "game_suggestion_votes",
  {
    suggestionId: uuid("suggestion_id")
      .notNull()
      .references(() => gameSuggestions.id, { onDelete: "cascade" }),
    voterUserId: uuid("voter_user_id")
      .notNull()
      .references(() => auth.user.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.suggestionId, table.voterUserId] })]
);

export const roomScores = zeoSchema.table(
  "room_scores",
  {
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => auth.user.id, { onDelete: "cascade" }),
    totalScore: integer("total_score").default(0).notNull(),
    gamesPlayed: integer("games_played").default(0).notNull(),
    updatedAt: timestamp("updated_at")
      .$default(() => sql`now()`)
      .$onUpdate(() => sql`now()`)
      .notNull(),
  },
  (table) => [primaryKey({ columns: [table.roomId, table.userId] }), index("room_scores_room_id_idx").on(table.roomId)]
);

export const operatorSettings = zeoSchema.table("operator_settings", {
  id,
  maxConcurrentRooms: integer("max_concurrent_rooms").default(2).notNull(),
  maxParticipantsPerRoom: integer("max_participants_per_room").default(6).notNull(),
  chatEnabled: boolean("chat_enabled").default(true).notNull(),
  waitingRoomDefaultEnabled: boolean("waiting_room_default_enabled").default(false).notNull(),
  scheduledRoomsEnabled: boolean("scheduled_rooms_enabled").default(true).notNull(),
  updatedAt: timestamp("updated_at")
    .$default(() => sql`now()`)
    .$onUpdate(() => sql`now()`)
    .notNull(),
  updatedById: uuid("updated_by_id").references(() => auth.user.id, { onDelete: "set null" }),
});
