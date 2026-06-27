import { z } from "zod";

export const createRoomSchema = z.object({
  displayName: z.string().trim().min(1, "Room name is required").max(80, "Room name is too long"),
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
