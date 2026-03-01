import { db, schema } from "@pocket-dimension/db";
import cron from "node-cron";
import webpush from "web-push";
import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import { VAPID_PRIVATE_KEY, VAPID_SUBJECT } from "$env/static/private";
import { PUBLIC_VAPID_KEY } from "$env/static/public";

let started = false;

function getTodayDayInt(timezone: string): number {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const y = parseInt(parts.find((p) => p.type === "year")?.value ?? "0");
  const m = parseInt(parts.find((p) => p.type === "month")?.value ?? "0");
  const d = parseInt(parts.find((p) => p.type === "day")?.value ?? "0");
  return y * 10000 + m * 100 + d;
}

function getLocalHourMinute(timezone: string): string {
  const now = new Date();
  return now.toLocaleString("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

async function getDueSubscriptions(): Promise<(typeof schema.pushSubscription.$inferSelect)[]> {
  const active = await db
    .select()
    .from(schema.pushSubscription)
    .where(
      and(
        eq(schema.pushSubscription.active, true),
        or(isNull(schema.pushSubscription.lastNotifiedAt), lt(schema.pushSubscription.lastNotifiedAt, sql`now() - interval '20 hours'`))
      )
    );

  return active.filter((sub) => {
    const localTime = getLocalHourMinute(sub.timezone);
    return localTime === sub.reminderTime;
  });
}

async function tick() {
  try {
    const due = await getDueSubscriptions();
    if (due.length === 0) return;

    console.log(`[notifications] Sending ${due.length} due reminders`);

    for (const sub of due) {
      const todayDayInt = getTodayDayInt(sub.timezone);
      const payload = JSON.stringify({
        title: "How was your day?",
        body: "Take a moment to reflect on today",
        url: `/day/${todayDayInt}`,
      });

      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.authKey },
          },
          payload
        );

        await db
          .update(schema.pushSubscription)
          .set({ lastNotifiedAt: sql`now()` })
          .where(eq(schema.pushSubscription.id, sub.id));
      } catch (error: unknown) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          console.log(`[notifications] Subscription ${sub.id} expired, deactivating`);
          await db.update(schema.pushSubscription).set({ active: false }).where(eq(schema.pushSubscription.id, sub.id));
        } else {
          console.error(`[notifications] Failed to send to ${sub.id}:`, error);
        }
      }
    }
  } catch (error) {
    console.error("[notifications] Cron tick error:", error);
  }
}

export function startNotificationScheduler() {
  if (started) return;
  if (!PUBLIC_VAPID_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) {
    console.warn("[notifications] VAPID keys not configured, skipping scheduler");
    return;
  }

  webpush.setVapidDetails(VAPID_SUBJECT, PUBLIC_VAPID_KEY, VAPID_PRIVATE_KEY);
  cron.schedule("* * * * *", tick);
  started = true;
  console.log("[notifications] Scheduler started - checking every minute for due reminders");
}
