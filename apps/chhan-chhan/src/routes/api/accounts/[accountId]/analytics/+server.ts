import { json } from "@sveltejs/kit";
import { getMembershipOrThrow, requireUser } from "$lib/server/authz";
import { getAnalytics } from "$lib/server/finance";

export async function GET({ locals, params }) {
  const user = requireUser(locals);
  await getMembershipOrThrow(user.id, params.accountId);
  const analytics = await getAnalytics(params.accountId);
  return json(analytics);
}
