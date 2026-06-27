import { db, schema } from "@pocket-dimension/db";
import { eq } from "drizzle-orm";
import { DEFAULT_MAX_CONCURRENT_ROOMS, DEFAULT_MAX_PARTICIPANTS_PER_ROOM } from "./constants";

export type OperatorSettings = {
  maxConcurrentRooms: number;
  maxParticipantsPerRoom: number;
  chatEnabled: boolean;
  waitingRoomDefaultEnabled: boolean;
  scheduledRoomsEnabled: boolean;
};

const DEFAULTS: OperatorSettings = {
  maxConcurrentRooms: DEFAULT_MAX_CONCURRENT_ROOMS,
  maxParticipantsPerRoom: DEFAULT_MAX_PARTICIPANTS_PER_ROOM,
  chatEnabled: true,
  waitingRoomDefaultEnabled: false,
  scheduledRoomsEnabled: true,
};

let cachedSettings: OperatorSettings | null = null;
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 5000;

async function ensureSettingsRow() {
  const existing = await db.query.operatorSettings.findFirst();
  if (existing) return existing;

  const [created] = await db
    .insert(schema.operatorSettings)
    .values({
      maxConcurrentRooms: DEFAULTS.maxConcurrentRooms,
      maxParticipantsPerRoom: DEFAULTS.maxParticipantsPerRoom,
      chatEnabled: DEFAULTS.chatEnabled,
      waitingRoomDefaultEnabled: DEFAULTS.waitingRoomDefaultEnabled,
      scheduledRoomsEnabled: DEFAULTS.scheduledRoomsEnabled,
    })
    .returning();

  return created;
}

export async function getOperatorSettings(forceRefresh = false): Promise<OperatorSettings> {
  const now = Date.now();
  if (!forceRefresh && cachedSettings && now < cacheExpiresAt) {
    return cachedSettings;
  }

  const row = await ensureSettingsRow();
  cachedSettings = {
    maxConcurrentRooms: row.maxConcurrentRooms,
    maxParticipantsPerRoom: row.maxParticipantsPerRoom,
    chatEnabled: row.chatEnabled,
    waitingRoomDefaultEnabled: row.waitingRoomDefaultEnabled,
    scheduledRoomsEnabled: row.scheduledRoomsEnabled,
  };
  cacheExpiresAt = now + CACHE_TTL_MS;
  return cachedSettings;
}

export function invalidateOperatorSettingsCache() {
  cachedSettings = null;
  cacheExpiresAt = 0;
}

export async function updateOperatorSettings(values: Partial<OperatorSettings> & { updatedById: string }) {
  const row = await ensureSettingsRow();

  const [updated] = await db
    .update(schema.operatorSettings)
    .set({
      ...(values.maxConcurrentRooms !== undefined ? { maxConcurrentRooms: values.maxConcurrentRooms } : {}),
      ...(values.maxParticipantsPerRoom !== undefined ? { maxParticipantsPerRoom: values.maxParticipantsPerRoom } : {}),
      ...(values.chatEnabled !== undefined ? { chatEnabled: values.chatEnabled } : {}),
      ...(values.waitingRoomDefaultEnabled !== undefined ? { waitingRoomDefaultEnabled: values.waitingRoomDefaultEnabled } : {}),
      ...(values.scheduledRoomsEnabled !== undefined ? { scheduledRoomsEnabled: values.scheduledRoomsEnabled } : {}),
      updatedById: values.updatedById,
      updatedAt: new Date(),
    })
    .where(eq(schema.operatorSettings.id, row.id))
    .returning();

  invalidateOperatorSettingsCache();
  return updated;
}
