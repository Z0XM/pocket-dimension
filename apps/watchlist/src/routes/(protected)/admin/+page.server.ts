import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) {
    throw redirect(307, "/login");
  }
  if (locals.user.role !== "admin") {
    throw redirect(307, "/");
  }

  return {
    user: {
      id: locals.user.id,
      username: locals.user.username,
      role: locals.user.role,
    },
  };
};
