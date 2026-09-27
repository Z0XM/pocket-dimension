import { createHash, randomInt, timingSafeEqual } from "node:crypto";

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export function generateOtpCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashOtpCode(code: string, profileId: string): string {
  const pepper = Bun.env.LEGACY_RECAP_CLAIM_SECRET?.trim() || Bun.env.BETTER_AUTH_SECRET?.trim() || "";
  return createHash("sha256").update(`${pepper}:${profileId}:${code}`).digest("hex");
}

export function otpMatches(code: string, profileId: string, codeHash: string): boolean {
  const got = Buffer.from(hashOtpCode(code, profileId));
  const want = Buffer.from(codeHash);
  if (got.length !== want.length) return false;
  return timingSafeEqual(got, want);
}

export function otpExpiresAt(now = Date.now()): Date {
  return new Date(now + OTP_TTL_MS);
}

export { OTP_TTL_MS, MAX_ATTEMPTS };
