import { db, schema } from "@pocket-dimension/db";
import { json } from "@sveltejs/kit";
import { and, eq } from "drizzle-orm";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ locals }) => {
  const user = locals.user;
  if (!user) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const subscriptions = await db
    .select({
      id: schema.pushSubscription.id,
      reminderTime: schema.pushSubscription.reminderTime,
    })
    .from(schema.pushSubscription)
    .where(and(eq(schema.pushSubscription.userId, user.id), eq(schema.pushSubscription.active, true)))
    .limit(1);

  if (subscriptions.length > 0) {
    return json({ subscribed: true, reminderTime: subscriptions[0].reminderTime });
  }
  return json({ subscribed: false, reminderTime: null });
};
