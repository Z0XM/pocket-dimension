import { error, redirect } from "@sveltejs/kit";
import { userHomePath } from "$lib/paths";

export function isProfileOwner(locals: App.Locals, username: string): boolean {
  return Boolean(locals.user?.emailVerified && locals.user.username && locals.user.username === username);
}

export function requireProfileOwner(locals: App.Locals, username: string) {
  if (!isProfileOwner(locals, username)) {
    throw error(403, "Forbidden");
  }

  return locals.user!;
}

export function requireUser(locals: App.Locals) {
  if (!locals.user?.id) {
    throw error(401, "Authentication required");
  }
  return locals.user;
}

export function requireVerifiedUser(locals: App.Locals) {
  const user = requireUser(locals);
  if (!user.emailVerified) {
    throw error(403, "Email verification required");
  }
  return user;
}

export function requireVerifiedUserForUsername(locals: App.Locals, username: string) {
  const user = requireVerifiedUser(locals);

  if (!user.username) {
    throw error(404, "User profile not found.");
  }

  if (user.username !== username) {
    redirect(307, userHomePath(user.username));
  }

  return user;
}
