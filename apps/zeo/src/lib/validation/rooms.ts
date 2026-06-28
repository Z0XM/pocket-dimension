import { z } from "zod";

export const createRoomSchema = z.object({
  displayName: z.string().trim().min(1, "Room name is required").max(80, "Room name is too long"),
  waitingRoomEnabled: z.boolean().optional(),
  isPublic: z.boolean().optional(),
  scheduledStartAt: z.string().datetime().optional(),
});

export const updateRoomSchema = z.object({
  isPublic: z.boolean(),
});

export const operatorSettingsSchema = z.object({
  maxConcurrentRooms: z.number().int().min(1).max(20),
  maxParticipantsPerRoom: z.number().int().min(2).max(50),
  chatEnabled: z.boolean(),
  waitingRoomDefaultEnabled: z.boolean(),
  scheduledRoomsEnabled: z.boolean(),
});

export const chatMessageSchema = z.object({
  body: z.string().trim().min(1, "Message is required").max(2000, "Message is too long"),
  guestIdentity: z
    .string()
    .regex(/^guest_[0-9a-f-]{36}$/i, "Invalid guest identity")
    .optional(),
});

export const waitingActionSchema = z.object({
  identity: z.string().min(1, "Participant identity is required"),
});

export const guestTokenSchema = z.object({
  guestName: z
    .string()
    .trim()
    .min(1, "Display name is required")
    .max(40, "Display name is too long")
    .regex(/^[\p{L}\p{N}\s._-]+$/u, "Display name contains invalid characters"),
  guestIdentity: z
    .string()
    .regex(/^guest_[0-9a-f-]{36}$/i, "Invalid guest identity")
    .optional(),
});

export const removeParticipantSchema = z.object({
  identity: z.string().min(1, "Participant identity is required"),
});
