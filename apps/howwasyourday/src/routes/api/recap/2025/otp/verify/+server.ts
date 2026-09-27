import { db, schema } from "@pocket-dimension/db";
import { json } from "@sveltejs/kit";
import { desc, eq } from "drizzle-orm";
import type { RequestHandler } from "./$types";
import { getProfileBySlug, upsertLink } from "$lib/server/legacy-recap/access";
import { CLAIM_COOKIE_NAME, claimCookieOptions, createClaimToken } from "$lib/server/legacy-recap/claim-cookie";
import { MAX_ATTEMPTS, otpMatches } from "$lib/server/legacy-recap/otp";
import { rateLimit } from "$lib/server/legacy-recap/rate-limit";

export const POST: RequestHandler = async ({ request, cookies, locals, getClientAddress }) => {
  let body: { slug?: string; code?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, { status: 400 });
  }

  const slug = body.slug?.trim();
  const code = body.code?.trim().replace(/\s+/g, "");
  if (!slug || !code || !/^\d{6}$/.test(code)) {
    return json({ error: "Invalid slug or code" }, { status: 400 });
  }

  const rl = rateLimit(`otp-verify:${getClientAddress()}:${slug}`, 20, 15 * 60 * 1000);
  if (!rl.ok) {
    return json({ error: "Too many requests", retryAfterSec: rl.retryAfterSec }, { status: 429 });
  }

  const profile = await getProfileBySlug(slug);
  if (!profile) {
    return json({ error: "Not found" }, { status: 404 });
  }

  const otps = await db
    .select()
    .from(schema.legacyRecapOtp)
    .where(eq(schema.legacyRecapOtp.profileId, profile.id))
    .orderBy(desc(schema.legacyRecapOtp.createdAt))
    .limit(1);

  const otp = otps[0];
  if (!otp || otp.expiresAt.getTime() < Date.now()) {
    return json({ error: "Code expired. Request a new one." }, { status: 400 });
  }
  if (otp.attempts >= MAX_ATTEMPTS) {
    return json({ error: "Too many attempts. Request a new code." }, { status: 400 });
  }

  if (!otpMatches(code, profile.id, otp.codeHash)) {
    await db
      .update(schema.legacyRecapOtp)
      .set({ attempts: otp.attempts + 1 })
      .where(eq(schema.legacyRecapOtp.id, otp.id));
    return json({ error: "Incorrect code" }, { status: 400 });
  }

  await db.delete(schema.legacyRecapOtp).where(eq(schema.legacyRecapOtp.profileId, profile.id));

  const token = createClaimToken(profile.id, profile.slug);
  cookies.set(CLAIM_COOKIE_NAME, token, claimCookieOptions());

  let linked = false;
  if (locals.user?.id) {
    await upsertLink(locals.user.id, profile.id);
    linked = true;
  }

  return json({
    ok: true,
    linked,
    redirectTo: `/recap/2025/${profile.slug}`,
    signedIn: !!locals.user,
  });
};
