import { auth, getDevModeSessionRedirect, isDevModeEnabled, logServerErrors } from "@pocket-dimension/auth";
import type { schema } from "@pocket-dimension/db";
import { json, redirect, type Handle } from "@sveltejs/kit";
import { sequence } from "@sveltejs/kit/hooks";
import { svelteKitHandler } from "better-auth/svelte-kit";
import { building } from "$app/environment";
import { canUsePortal, isPortalGatedRoute } from "$lib/admin-access";
import { loadZapAccess } from "$lib/server/admin/access";

const authHandle: Handle = async ({ event, resolve }) => {
  const session = await auth.api.getSession({
    headers: event.request.headers,
  });

  if (session) {
    event.locals.session = session.session;
    event.locals.user = session.user as typeof schema.user.$inferSelect;
  }

  event.locals.devMode = isDevModeEnabled();

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
        return redirect(307, "/home");
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

  if (session?.user.emailVerified && !building) {
    const gated = isPortalGatedRoute(event.route.id, event.url.pathname);
    const access = await loadZapAccess(session.user.id, { touch: gated });
    event.locals.zapAccess = access;
    if (gated && !canUsePortal(access.access)) {
      if (event.url.pathname.startsWith("/api/")) {
        const message = access.access === "blocked" ? "Your Zap access has been blocked by an admin." : "Your Zap access is pending admin approval.";
        return json({ message, access: access.access }, { status: 403 });
      }
      return redirect(307, "/blocked");
    }
  }

  return svelteKitHandler({ event, resolve, auth, building });
};

export const handle = sequence(logServerErrors, authHandle);
