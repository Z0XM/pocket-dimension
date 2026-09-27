import { createHmac, timingSafeEqual } from "node:crypto";

const COOKIE_NAME = "hwyd_legacy_recap_claim";
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export type ClaimPayload = {
  profileId: string;
  slug: string;
  exp: number;
};

function claimSecret(): string {
  const secret = Bun.env.LEGACY_RECAP_CLAIM_SECRET?.trim() || Bun.env.BETTER_AUTH_SECRET?.trim();
  if (!secret) {
    throw new Error("LEGACY_RECAP_CLAIM_SECRET or BETTER_AUTH_SECRET must be set");
  }
  return secret;
}

function sign(body: string): string {
  return createHmac("sha256", claimSecret()).update(body).digest("base64url");
}

export function createClaimToken(profileId: string, slug: string, now = Date.now()): string {
  const payload: ClaimPayload = {
    profileId,
    slug,
    exp: now + TTL_MS,
  };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifyClaimToken(token: string | undefined, expectedSlug?: string): ClaimPayload | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = sign(body);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as ClaimPayload;
    if (!payload?.profileId || !payload?.slug || typeof payload.exp !== "number") return null;
    if (payload.exp < Date.now()) return null;
    if (expectedSlug && payload.slug !== expectedSlug) return null;
    return payload;
  } catch {
    return null;
  }
}

export function claimCookieOptions(maxAgeSeconds = Math.floor(TTL_MS / 1000)) {
  const secure = Bun.env.NODE_ENV === "production";
  return {
    path: "/",
    httpOnly: true,
    sameSite: (secure ? "none" : "lax") as "none" | "lax",
    secure,
    maxAge: maxAgeSeconds,
  };
}

export { COOKIE_NAME as CLAIM_COOKIE_NAME };
