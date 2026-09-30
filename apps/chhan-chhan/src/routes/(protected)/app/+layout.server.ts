import { redirect } from "@sveltejs/kit";
import { resolveRequestAccount } from "$lib/server/active-account";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ locals, cookies }) => {
  if (!locals.user?.id) {
    redirect(307, "/login");
  }

  const { account, accounts } = await resolveRequestAccount(locals.user.id, cookies);
  return { account, accounts };
};
