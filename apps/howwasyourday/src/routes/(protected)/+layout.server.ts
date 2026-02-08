import { db, schema } from "@pocket-dimension/db";
import { redirect } from "@sveltejs/kit";
import { and, eq, gte, lte } from "drizzle-orm";
import { toDayInt } from "$lib/utils";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ locals, url }) => {
  const user = locals.user;
  if (!user) {
    return redirect(307, "/login");
  }

  const now = new Date();
  const year = now.getFullYear();
  const todayDayInt = toDayInt(now);
  const yearStart = year * 10000 + 101; // Jan 1
  const yearEnd = year * 10000 + 1231; // Dec 31

  const rows = await db
    .select({
      dayInt: schema.dayData.day_int,
      metadata: schema.dayData.metadata,
    })
    .from(schema.dayData)
    .where(and(eq(schema.dayData.user_id, user.id), gte(schema.dayData.day_int, yearStart), lte(schema.dayData.day_int, yearEnd)));

  const filledDays = rows.map((r) => r.dayInt);
  const todayFilled = filledDays.includes(todayDayInt);

  const publicNotes = rows
    .filter((r) => {
      const meta = r.metadata as Record<string, unknown>;
      return meta?.dayPublicNote && typeof meta.dayPublicNote === "string" && meta.dayPublicNote.trim() !== "";
    })
    .map((r) => ({
      dayInt: r.dayInt,
      note: (r.metadata as Record<string, unknown>).dayPublicNote as string,
    }));

  // Redirect to today's day form if today is not filled and user is on the home page
  if (!todayFilled && url.pathname === "/") {
    return redirect(307, `/day/${todayDayInt}`);
  }

  return {
    filledDays,
    todayFilled,
    publicNotes,
    todayDayInt,
  };
};
