import { redirect } from "@sveltejs/kit";
import { canUsePortal } from "$lib/admin-access";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) throw redirect(307, "/login?redirect=/home");
  if (!locals.user.emailVerified) throw redirect(307, "/check-email?reason=verify");
  const access = locals.zapAccess?.access ?? "allowed";
  if (canUsePortal(access)) throw redirect(307, "/home");
  return { access: access as "blocked" | "pending" };
};
