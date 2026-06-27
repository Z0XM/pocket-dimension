import { boolean, index, integer, pgSchema, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import * as auth from "./auth";
import { actionsByUser, id, timestamps } from "./common";

export const zeoSchema = pgSchema("zeo");

export const roomStatus = zeoSchema.enum("room_status", ["waiting", "active", "ended"]);
export const sessionBlockReason = zeoSchema.enum("session_block_reason", ["removed"]);

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
    endedAt: timestamp("ended_at"),
  },
  (table) => [
    unique("rooms_slug_unique").on(table.slug),
    unique("rooms_livekit_room_name_unique").on(table.livekitRoomName),
    index("rooms_host_user_id_idx").on(table.hostUserId),
    index("rooms_status_idx").on(table.status),
  ]
);

export const roomParticipants = zeoSchema.table(
  "room_participants",
  {
    id,
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => auth.user.id, { onDelete: "set null" }),
    guestDisplayName: text("guest_display_name"),
    isGuest: boolean("is_guest").default(false).notNull(),
    joinedAt: timestamp("joined_at")
      .$default(() => sql`now()`)
      .notNull(),
    leftAt: timestamp("left_at"),
    removedById: uuid("removed_by_id").references(() => auth.user.id, { onDelete: "set null" }),
  },
  (table) => [index("room_participants_room_id_idx").on(table.roomId), index("room_participants_user_id_idx").on(table.userId)]
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
