import { boolean, index, integer, pgSchema, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import * as auth from "./auth";
import { actionsByUser, id, timestamps } from "./common";

export const zeoSchema = pgSchema("zeo");

export const roomStatus = zeoSchema.enum("room_status", ["waiting", "active", "ended"]);
export const sessionBlockReason = zeoSchema.enum("session_block_reason", ["removed"]);
export const waitingEntryStatus = zeoSchema.enum("waiting_entry_status", ["pending", "admitted", "denied"]);

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
    body: text("body").notNull(),
    createdAt: timestamp("created_at")
      .$default(() => sql`now()`)
      .notNull(),
  },
  (table) => [index("chat_messages_room_id_idx").on(table.roomId), index("chat_messages_room_id_created_at_idx").on(table.roomId, table.createdAt)]
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
