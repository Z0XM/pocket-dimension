import { redirect } from "@sveltejs/kit";

import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user?.id) {
    redirect(307, "/login");
  }

  const userId = locals.user.id;

  return {};
};
