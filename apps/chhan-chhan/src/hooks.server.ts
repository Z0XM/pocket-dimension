import { auth, getDevModeSessionRedirect, isDevModeEnabled } from "@pocket-dimension/auth";
import type { schema } from "@pocket-dimension/db";
import { redirect, type Handle } from "@sveltejs/kit";
import { svelteKitHandler } from "better-auth/svelte-kit";
import { building } from "$app/environment";

export const handle: Handle = async ({ event, resolve }) => {
  const { pathname } = event.url;

  if (pathname === "/sample" || pathname.startsWith("/sample/")) {
    throw redirect(307, "/app");
  }

  const session = await auth.api.getSession({
    headers: event.request.headers,
  });

  if (session) {
    event.locals.session = session.session;
    event.locals.user = session.user as typeof schema.user.$inferSelect;
  }

  event.locals.devMode = isDevModeEnabled();

  // Dev Mode: establish a real session for the default allowlisted account
  if (!session && event.locals.devMode && !event.url.pathname.startsWith("/api/") && !building) {
    const authBaseUrl = Bun.env.BETTER_AUTH_URL ?? Bun.env.PUBLIC_BASE_AUTH_URL;
    if (authBaseUrl) {
      const target = getDevModeSessionRedirect({
        authBaseUrl,
        appOrigin: event.url.origin,
        pathname: event.url.pathname,
        search: event.url.search,
        hasSession: false,
      });
      if (target) {
        return redirect(307, target);
      }
    }
  }

  if (event.route.id?.startsWith("/(auth)/")) {
    const allowedAuthRoutes = ["/(auth)/verify-email", "/(auth)/check-email"];
    const isAllowedAuthRoute = allowedAuthRoutes.some((route) => event.route.id?.startsWith(route));

    if (session && !isAllowedAuthRoute) {
      if (session.user.emailVerified) {
        return redirect(307, "/app");
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
