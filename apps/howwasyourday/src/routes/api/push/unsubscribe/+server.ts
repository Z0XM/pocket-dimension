import { db, schema } from "@pocket-dimension/db";
import { json } from "@sveltejs/kit";
import { and, eq } from "drizzle-orm";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request, locals }) => {
  const user = locals.user;
  if (!user) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { endpoint } = body as { endpoint?: string };

  if (endpoint) {
    await db.delete(schema.pushSubscription).where(and(eq(schema.pushSubscription.userId, user.id), eq(schema.pushSubscription.endpoint, endpoint)));
  } else {
    await db.delete(schema.pushSubscription).where(eq(schema.pushSubscription.userId, user.id));
  }

  return json({ success: true });
};
