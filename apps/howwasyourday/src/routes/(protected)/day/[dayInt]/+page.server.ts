import { db, schema } from "@pocket-dimension/db";
import { fail, redirect } from "@sveltejs/kit";
import { and, eq } from "drizzle-orm";
import { getEffectiveDayInt, getEffectiveDayIntForTz } from "$lib/utils";
import type { Actions, PageServerLoad } from "./$types";

function getTodayDayInt(cookies: { get: (name: string) => string | undefined }): number {
  const now = new Date();
  const tzOffsetStr = cookies.get("tz_offset");
  return tzOffsetStr != null && !Number.isNaN(parseInt(tzOffsetStr)) ? getEffectiveDayIntForTz(now, parseInt(tzOffsetStr)) : getEffectiveDayInt(now);
}

export const load: PageServerLoad = async ({ locals, params, cookies }) => {
  const user = locals.user;
  if (!user) {
    return redirect(307, "/login");
  }

  const dayInt = parseInt(params.dayInt, 10);
  if (Number.isNaN(dayInt)) {
    return redirect(307, "/");
  }

  // Validate: must be current year
  const todayDayInt = getTodayDayInt(cookies);
  const year = Math.floor(todayDayInt / 10000);
  const paramYear = Math.floor(dayInt / 10000);
  if (paramYear !== year) {
    return redirect(307, "/");
  }

  // Validate: must not be in the future
  if (dayInt > todayDayInt) {
    return redirect(307, "/");
  }

  // Query existing data for this day
  const existing = await db
    .select({
      metadata: schema.dayData.metadata,
    })
    .from(schema.dayData)
    .where(and(eq(schema.dayData.user_id, user.id), eq(schema.dayData.day_int, dayInt)))
    .limit(1);

  const metadata = (existing[0]?.metadata as Record<string, unknown>) ?? null;

  return {
    dayInt,
    metadata,
  };
};

export const actions: Actions = {
  default: async ({ request, locals, params, cookies }) => {
    const user = locals.user;
    if (!user) {
      return redirect(307, "/login");
    }

    const dayInt = parseInt(params.dayInt, 10);
    if (Number.isNaN(dayInt)) {
      return fail(400, { error: "Invalid day" });
    }

    // Validate: must be current year and not future
    const todayDayInt = getTodayDayInt(cookies);
    const year = Math.floor(todayDayInt / 10000);
    const paramYear = Math.floor(dayInt / 10000);
    if (paramYear !== year) {
      return fail(400, { error: "Invalid year" });
    }

    if (dayInt > todayDayInt) {
      return fail(400, { error: "Cannot fill future days" });
    }

    const formData = await request.formData();

    const strOrNull = (key: string): string | null => {
      const v = (formData.get(key) as string) ?? "";
      return v.trim() ? v : null;
    };

    const ratingRaw = strOrNull("dayRating");
    const ratingParsed = ratingRaw !== null ? parseFloat(ratingRaw) : null;

    const metadata = {
      dayRating: ratingParsed !== null && !Number.isNaN(ratingParsed) ? ratingParsed : null,
      dayEmoji: strOrNull("dayEmoji"),
      dayWord: strOrNull("dayWord"),
      dayColor: strOrNull("dayColor"),
      dayPerson: strOrNull("dayPerson"),
      dayNote: strOrNull("dayNote"),
      dayPublicNote: strOrNull("dayPublicNote"),
      dayDrawing: strOrNull("dayDrawing"),
    };

    // Check if record already exists
    const existing = await db
      .select({ id: schema.dayData.id })
      .from(schema.dayData)
      .where(and(eq(schema.dayData.user_id, user.id), eq(schema.dayData.day_int, dayInt)))
      .limit(1);

    if (existing.length > 0) {
      // Update
      await db
        .update(schema.dayData)
        .set({
          metadata,
          updatedById: user.id,
        })
        .where(eq(schema.dayData.id, existing[0].id));
    } else {
      // Insert
      await db.insert(schema.dayData).values({
        metadata,
        day_int: dayInt,
        user_id: user.id,
        createdById: user.id,
        updatedById: user.id,
      });
    }

    return redirect(303, "/");
  },
};
