import { isDevModeEnabled } from "@pocket-dimension/auth";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getProfileBySlug, upsertLink } from "$lib/server/legacy-recap/access";
import { CLAIM_COOKIE_NAME, claimCookieOptions, createClaimToken } from "$lib/server/legacy-recap/claim-cookie";

/** Local-only: issue the claim cookie without email OTP when DEV_MODE is on. */
export const POST: RequestHandler = async ({ request, cookies, locals }) => {
  if (!isDevModeEnabled()) {
    return json({ error: "OTP bypass is only available in local DEV_MODE" }, { status: 403 });
  }

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
    return json({ error: "Not found" }, { status: 404 });
  }

  const token = createClaimToken(profile.id, profile.slug);
  cookies.set(CLAIM_COOKIE_NAME, token, claimCookieOptions());

  let linked = false;
  if (locals.user?.id) {
    await upsertLink(locals.user.id, profile.id);
    linked = true;
  }

  return json({
    ok: true,
    bypass: true,
    linked,
    redirectTo: `/recap/2025/${profile.slug}`,
    signedIn: !!locals.user,
  });
};
