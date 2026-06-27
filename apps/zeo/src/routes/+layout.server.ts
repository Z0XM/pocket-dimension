import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ locals }) => {
  return {
    user: locals.user
      ? {
          id: locals.user.id,
          email: locals.user.email,
          username: locals.user.username,
          emailVerified: locals.user.emailVerified,
          role: locals.user.role,
        }
      : null,
  };
};
