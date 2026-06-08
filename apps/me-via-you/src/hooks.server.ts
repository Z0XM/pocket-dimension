import { auth } from "@pocket-dimension/auth";
import type { schema } from "@pocket-dimension/db";
import { userHomePathOrLogin } from "$lib/paths";
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
    const allowedAuthRoutes = ["/(auth)/verify-email", "/(auth)/check-email"];
    const isAllowedAuthRoute = allowedAuthRoutes.some((route) => event.route.id?.startsWith(route));

    if (session && !isAllowedAuthRoute) {
      if (session.user.emailVerified) {
        return redirect(307, userHomePathOrLogin(session.user.username));
      }
    }
  }

  if (event.route.id?.startsWith("/(protected)")) {
    if (!session) {
      const returnTo = encodeURIComponent(event.url.pathname + event.url.search);
      return redirect(307, `/login?redirect=${returnTo}`);
    }
    if (!session.user.emailVerified) {
      return redirect(307, "/check-email?reason=verify");
    }
  }

  return svelteKitHandler({ event, resolve, auth, building });
};
