import { error } from "@sveltejs/kit";

export function requireUser(locals: App.Locals) {
  if (!locals.user?.id) {
    throw error(401, "Authentication required");
  }
  return locals.user;
}

export function displayNameForUser(user: NonNullable<App.Locals["user"]>) {
  return user.username?.trim() || user.email.split("@")[0] || user.email;
}
