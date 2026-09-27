import { db, schema } from "@pocket-dimension/db";
import { json } from "@sveltejs/kit";
import { eq } from "drizzle-orm";
import type { RequestHandler } from "./$types";
import { getProfileBySlug } from "$lib/server/legacy-recap/access";
import { generateOtpCode, hashOtpCode, otpExpiresAt } from "$lib/server/legacy-recap/otp";
import { sendLegacyRecapOtpEmail } from "$lib/server/legacy-recap/email";
import { rateLimit } from "$lib/server/legacy-recap/rate-limit";

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
  let body: { slug?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, { status: 400 });
  }

  const slug = body.slug?.trim();
  if (!slug) {
    return json({ error: "Missing slug" }, { status: 400 });
  }

  const profile = await getProfileBySlug(slug);
  if (!profile) {
    // Avoid slug enumeration timing; still 404
    return json({ error: "Not found" }, { status: 404 });
  }

  const ip = getClientAddress();
  const rlProfile = rateLimit(`otp-send:profile:${profile.id}`, 3, 15 * 60 * 1000);
  const rlIp = rateLimit(`otp-send:ip:${ip}`, 10, 15 * 60 * 1000);
  if (!rlProfile.ok || !rlIp.ok) {
    const retry = Math.max(!rlProfile.ok ? rlProfile.retryAfterSec : 0, !rlIp.ok ? rlIp.retryAfterSec : 0);
    return json({ error: "Too many requests", retryAfterSec: retry }, { status: 429 });
  }

  // Clear prior OTPs for this profile
  await db.delete(schema.legacyRecapOtp).where(eq(schema.legacyRecapOtp.profileId, profile.id));

  const code = generateOtpCode();
  const codeHash = hashOtpCode(code, profile.id);
  const expiresAt = otpExpiresAt();

  await db.insert(schema.legacyRecapOtp).values({
    profileId: profile.id,
    codeHash,
    expiresAt,
    attempts: 0,
  });

  const sent = await sendLegacyRecapOtpEmail({
    to: profile.email,
    displayName: profile.displayName,
    code,
  });

  if (!sent.ok) {
    return json({ error: sent.error }, { status: 503 });
  }

  return json({ ok: true });
};
