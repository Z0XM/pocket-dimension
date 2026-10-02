import type { Cookies } from "@sveltejs/kit";
import { ACTIVE_ACCOUNT_COOKIE, resolveActiveAccount } from "$lib/server/finance";

function cookieOptions() {
  return {
    path: "/",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  };
}

export async function resolveRequestAccount(userId: string, cookies: Cookies) {
  const preferredId = cookies.get(ACTIVE_ACCOUNT_COOKIE) ?? null;
  const { account, accounts } = await resolveActiveAccount(userId, preferredId);

  if (cookies.get(ACTIVE_ACCOUNT_COOKIE) !== account.id) {
    cookies.set(ACTIVE_ACCOUNT_COOKIE, account.id, cookieOptions());
  }

  return { account, accounts };
}

export function setActiveAccountCookie(cookies: Cookies, accountId: string) {
  cookies.set(ACTIVE_ACCOUNT_COOKIE, accountId, cookieOptions());
}
