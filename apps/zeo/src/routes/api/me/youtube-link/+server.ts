import { db, schema } from "@pocket-dimension/db";
import { and, eq, isNull } from "drizzle-orm";
import { json } from "@sveltejs/kit";
import { requireUser } from "$lib/server/authz";
import { endListeningSessionsForLinker } from "$lib/server/listening/sessions";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ locals }) => {
  const user = requireUser(locals);
  const link = await db.query.youtubeAccountLinks.findFirst({
    where: and(eq(schema.youtubeAccountLinks.userId, user.id), isNull(schema.youtubeAccountLinks.revokedAt)),
  });

  return json({
    linked: Boolean(link),
    linkedAt: link?.linkedAt.toISOString() ?? null,
    scopes: link?.scopes ?? [],
  });
};

export const DELETE: RequestHandler = async ({ locals }) => {
  const user = requireUser(locals);
  await endListeningSessionsForLinker(user.id);
  await db.delete(schema.youtubeAccountLinks).where(eq(schema.youtubeAccountLinks.userId, user.id));

  return json({ linked: false });
};
