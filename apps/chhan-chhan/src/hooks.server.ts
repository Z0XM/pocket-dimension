import { auth } from "@pocket-dimension/auth";
import type { schema } from "@pocket-dimension/db";
import { redirect, type Handle } from "@sveltejs/kit";
import { svelteKitHandler } from "better-auth/svelte-kit";
import { building } from "$app/environment";

export const handle: Handle = async ({ event, resolve }) => {
  const session = await auth.api.getSession({
    headers: event.request.headers,
  });

  if (session) {
    event.locals.session = session.session;
    event.locals.user = session.user as typeof schema.user.$inferSelect;
  }

  if (event.route.id?.startsWith("/(auth)/")) {
    const allowlisted = ["/(auth)/verify-email", "/(auth)/check-email"];
    const isAllowlisted = allowlisted.some((route) => event.route.id?.startsWith(route));
    if (session?.user.emailVerified && !isAllowlisted) {
      return redirect(307, "/");
    }
  }

  return svelteKitHandler({ event, resolve, auth, building });
};
