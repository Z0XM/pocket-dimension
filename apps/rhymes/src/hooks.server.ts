import { auth } from "@pocket-dimension/auth";
import type { schema } from "@pocket-dimension/db";
import { redirect } from "@sveltejs/kit";
import { svelteKitHandler } from "better-auth/svelte-kit";
import { building } from "$app/environment";
import type { Handle } from "@sveltejs/kit";

export const handle: Handle = async ({ event, resolve }) => {
  const session = await auth.api.getSession({
    headers: event.request.headers,
  });

  if (session) {
    event.locals.session = session.session;
    event.locals.user = session.user as typeof schema.user.$inferSelect;
  }

  if (event.route.id?.startsWith("/(auth)/")) {
    const allowedWhileLoggedIn = ["/(auth)/verify-email", "/(auth)/check-email"];
    const isAllowed = allowedWhileLoggedIn.some((route) => event.route.id?.startsWith(route));
    if (session?.user.emailVerified && !isAllowed) {
      return redirect(307, "/");
    }
  }

  if (event.route.id?.startsWith("/admin")) {
    if (!session) {
      return redirect(307, `/login?redirect=${encodeURIComponent(event.url.pathname)}`);
    }
    if (!session.user.emailVerified) {
      return redirect(307, "/check-email?reason=verify");
    }
  }

  return svelteKitHandler({ event, resolve, auth, building });
};
