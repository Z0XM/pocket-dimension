import { db, schema } from "@pocket-dimension/db";
import { and, eq, gt } from "drizzle-orm";

const MAX_CHAT_BODY_LENGTH = 2000;

export function sanitizeChatBody(raw: string) {
  const stripped = raw
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim();
  return stripped.slice(0, MAX_CHAT_BODY_LENGTH);
}

export async function listChatMessages(options: { roomId: string; after?: Date; limit?: number }) {
  const { roomId, after, limit = 100 } = options;

  return db.query.chatMessages.findMany({
    where: after ? and(eq(schema.chatMessages.roomId, roomId), gt(schema.chatMessages.createdAt, after)) : eq(schema.chatMessages.roomId, roomId),
    orderBy: (table, { asc }) => [asc(table.createdAt)],
    limit,
  });
}

export async function sendChatMessage(options: { roomId: string; senderIdentity: string; senderDisplayName: string; body: string }) {
  const body = sanitizeChatBody(options.body);
  if (!body) {
    return { error: "empty" as const };
  }

  const [message] = await db
    .insert(schema.chatMessages)
    .values({
      roomId: options.roomId,
      senderIdentity: options.senderIdentity,
      senderDisplayName: options.senderDisplayName,
      body,
    })
    .returning();

  return { message };
}
