import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { env } from "$lib/server/env";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;

function encryptionSecret() {
  if (env.YOUTUBE_TOKEN_SECRET) {
    return env.YOUTUBE_TOKEN_SECRET;
  }
  if (Bun.env.BETTER_AUTH_SECRET) {
    return Bun.env.BETTER_AUTH_SECRET;
  }
  throw new Error("YOUTUBE_TOKEN_SECRET or BETTER_AUTH_SECRET is required to store YouTube tokens");
}

function encryptionKey() {
  return createHash("sha256").update(encryptionSecret()).digest();
}

export function encryptToken(token: string) {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [iv, tag, encrypted].map((part) => part.toString("base64url")).join(".");
}

export function decryptToken(payload: string) {
  const [ivPart, tagPart, encryptedPart] = payload.split(".");
  if (!ivPart || !tagPart || !encryptedPart) {
    throw new Error("Invalid encrypted token payload");
  }

  const iv = Buffer.from(ivPart, "base64url");
  const tag = Buffer.from(tagPart, "base64url");
  const encrypted = Buffer.from(encryptedPart, "base64url");
  const decipher = createDecipheriv(ALGORITHM, encryptionKey(), iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
