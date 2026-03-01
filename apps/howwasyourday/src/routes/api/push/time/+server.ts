import { db, schema } from "@pocket-dimension/db";
import { json } from "@sveltejs/kit";
import { and, eq } from "drizzle-orm";
import type { RequestHandler } from "./$types";

export const PATCH: RequestHandler = async ({ request, locals }) => {
  const user = locals.user;
  if (!user) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { reminderTime } = body as { reminderTime: string };

  if (!reminderTime || !/^\d{2}:\d{2}$/.test(reminderTime)) {
    return json({ error: "Invalid time format, expected HH:MM" }, { status: 400 });
  }

  const [h, m] = reminderTime.split(":").map(Number);
  if (h < 0 || h > 23 || m < 0 || m > 59) {
    return json({ error: "Invalid time value" }, { status: 400 });
  }

  await db
    .update(schema.pushSubscription)
    .set({ reminderTime })
    .where(and(eq(schema.pushSubscription.userId, user.id), eq(schema.pushSubscription.active, true)));

  return json({ success: true, reminderTime });
};
