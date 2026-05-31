import { redirect } from "@sveltejs/kit";
import { getOrCreateDefaultAccount } from "$lib/server/finance";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ locals }) => {
  if (!locals.user?.id) {
    redirect(307, "/login");
  }

  const account = await getOrCreateDefaultAccount(locals.user.id);

  return { account };
};
