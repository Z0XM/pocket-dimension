import { userHomePathOrLogin } from "$lib/paths";
import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

/** `/` redirects authenticated users to their profile, others to login. */
export const load: PageServerLoad = async ({ locals }) => {
  if (locals.user?.emailVerified && locals.user.username) {
    redirect(307, userHomePathOrLogin(locals.user.username));
  }

  if (locals.user && !locals.user.emailVerified) {
    redirect(307, "/check-email?reason=verify");
  }

  redirect(307, "/login");
};
