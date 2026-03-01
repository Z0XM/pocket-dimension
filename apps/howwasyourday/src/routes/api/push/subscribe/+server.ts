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
  const { endpoint, keys, timezone, reminderTime } = body as {
    endpoint: string;
    keys: { p256dh: string; auth: string };
    timezone: string;
    reminderTime?: string;
  };

  if (!endpoint || !keys?.p256dh || !keys?.auth || !timezone) {
    return json({ error: "Missing required fields" }, { status: 400 });
  }

  const time = reminderTime && /^\d{2}:\d{2}$/.test(reminderTime) ? reminderTime : "21:00";

  const existing = await db
    .select({ id: schema.pushSubscription.id })
    .from(schema.pushSubscription)
    .where(and(eq(schema.pushSubscription.userId, user.id), eq(schema.pushSubscription.endpoint, endpoint)))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(schema.pushSubscription)
      .set({
        p256dh: keys.p256dh,
        authKey: keys.auth,
        timezone,
        reminderTime: time,
        active: true,
      })
      .where(eq(schema.pushSubscription.id, existing[0].id));
  } else {
    await db.insert(schema.pushSubscription).values({
      userId: user.id,
      endpoint,
      p256dh: keys.p256dh,
      authKey: keys.auth,
      timezone,
      reminderTime: time,
      active: true,
    });
  }

  return json({ success: true });
};
