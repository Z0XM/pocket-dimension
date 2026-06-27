import { error } from "@sveltejs/kit";

export function requireUser(locals: App.Locals) {
  if (!locals.user?.id) {
    throw error(401, "Authentication required");
  }
  return locals.user;
}

export function requireContributorOrAdmin(locals: App.Locals) {
  const user = requireUser(locals);
  if (user.role !== "contributor" && user.role !== "admin") {
    throw error(403, "Only contributors and admins can create rooms");
  }
  return user;
}

export function canCreateRoom(role: string) {
  return role === "contributor" || role === "admin";
}

export function displayNameForUser(user: NonNullable<App.Locals["user"]>) {
  return user.username?.trim() || user.email.split("@")[0] || user.email;
}

export function requireHost(userId: string, hostUserId: string) {
  if (userId !== hostUserId) {
    throw error(403, "Only the room host can perform this action");
  }
}
