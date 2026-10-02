import { error, json } from "@sveltejs/kit";
import { getMembershipOrThrow, requireUser } from "$lib/server/authz";
import { setActiveAccountCookie } from "$lib/server/active-account";
import { readJsonBody } from "$lib/server/http";
import { switchAccountSchema } from "$lib/validation/finance";

export async function POST({ locals, request, cookies }) {
  const user = requireUser(locals);
  const payload = await readJsonBody(request, switchAccountSchema);
  await getMembershipOrThrow(user.id, payload.accountId);
  setActiveAccountCookie(cookies, payload.accountId);
  return json({ ok: true, accountId: payload.accountId });
}
