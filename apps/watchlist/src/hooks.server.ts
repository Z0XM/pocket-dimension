import { auth } from "@pocket-dimension/auth";
import type { schema } from "@pocket-dimension/db";
import { redirect } from "@sveltejs/kit";
import { svelteKitHandler } from "better-auth/svelte-kit";
import { building } from "$app/environment";

export async function handle({ event, resolve }) {
  // Fetch current session from Better Auth
  const session = await auth.api.getSession({
    headers: event.request.headers,
  });

  // Make session and user available on server
  if (session) {
    event.locals.session = session.session;
    event.locals.user = session.user as typeof schema.user.$inferSelect;
  }

  // Auth routes - redirect to home if already logged in
  // But allow verify-email, check-email pages for logged-in users who need to verify
  if (event.route.id?.startsWith("/(auth)/")) {
    const allowedAuthRoutes = ["/(auth)/verify-email", "/(auth)/check-email"];
    const isAllowedAuthRoute = allowedAuthRoutes.some((route) => event.route.id?.startsWith(route));

    if (session && !isAllowedAuthRoute) {
      // If user is logged in and verified, redirect to home
      if (session.user.emailVerified) {
        return redirect(307, "/");
      }
      // If not verified, allow access to verification-related pages
    }
  }

  // Protected routes - require authenticated AND verified user
  if (event.route.id?.startsWith("/(protected)/")) {
    if (!session) {
      return redirect(307, "/login");
    }
    // Check email verification
    if (!session.user.emailVerified) {
      return redirect(307, "/check-email?reason=verify");
    }
  }

  return svelteKitHandler({ event, resolve, auth, building });
}
