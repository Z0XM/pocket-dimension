import { randomBytes } from "node:crypto";

export function generateRoomSlug() {
  return randomBytes(12).toString("base64url");
}

export function generateGuestIdentity() {
  return `guest_${crypto.randomUUID()}`;
}

export function sanitizeGuestDisplayName(name: string) {
  return name.trim().slice(0, 40);
}
