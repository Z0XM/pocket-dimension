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

  // Build maps of dayInt → emoji, dayInt → color, dayInt → rating for calendar/graph display
  const dayEmojiMap: Record<number, string | null> = {};
  const dayColorMap: Record<number, string | null> = {};
  const dayRatingMap: Record<number, number | null> = {};
  for (const r of rows) {
    const meta = r.metadata as Record<string, unknown>;
    const emoji = typeof meta?.dayEmoji === "string" && meta.dayEmoji.trim() !== "" ? meta.dayEmoji : null;
    const color = typeof meta?.dayColor === "string" && meta.dayColor.trim() !== "" ? meta.dayColor : null;
    const rating = typeof meta?.dayRating === "number" ? meta.dayRating : null;
    dayEmojiMap[r.dayInt] = emoji;
    dayColorMap[r.dayInt] = color;
    dayRatingMap[r.dayInt] = rating;
  }

  // Fetch today's public notes from ALL users
  const todayPublicRows = await db
    .select({
      metadata: schema.dayData.metadata,
      userName: schema.user.name,
      displayUsername: schema.user.displayUsername,
      username: schema.user.username,
    })
    .from(schema.dayData)
    .innerJoin(schema.user, eq(schema.dayData.user_id, schema.user.id))
    .where(eq(schema.dayData.day_int, todayDayInt));

  const publicNotes = todayPublicRows
    .filter((r) => {
      const meta = r.metadata as Record<string, unknown>;
      return meta?.dayPublicNote && typeof meta.dayPublicNote === "string" && meta.dayPublicNote.trim() !== "";
    })
    .map((r) => ({
      note: (r.metadata as Record<string, unknown>).dayPublicNote as string,
      author: r.displayUsername || r.username || r.userName,
    }));

  // Collect today's drawings from ALL users
  const todayDrawings = todayPublicRows
    .filter((r) => {
      const meta = r.metadata as Record<string, unknown>;
      return meta?.dayDrawing && typeof meta.dayDrawing === "string" && meta.dayDrawing.trim() !== "";
    })
    .map((r) => ({
      drawing: (r.metadata as Record<string, unknown>).dayDrawing as string,
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
    dayEmojiMap,
    dayColorMap,
    dayRatingMap,
    todayDrawings,
  };
};
