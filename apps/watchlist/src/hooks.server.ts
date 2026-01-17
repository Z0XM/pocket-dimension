import { auth } from "@pocket-dimension/auth";
import type { schema } from "@pocket-dimension/db";
import { redirect } from "@sveltejs/kit";
import { svelteKitHandler } from "better-auth/svelte-kit";
import { building } from "$app/environment";

export async function handle({ event, resolve }) {
  const routeId = event.route.id || "unknown";
  const pathname = event.url.pathname;
  let session = null;

  try {
    // Fetch current session from Better Auth
    session = await auth.api.getSession({
      headers: event.request.headers,
    });

    // Make session and user available on server
    if (session) {
      event.locals.session = session.session;
      event.locals.user = session.user as typeof schema.user.$inferSelect;
      console.log(`[Auth] Session found for user ${session.user.id} (${session.user.email}) - Route: ${routeId} - Path: ${pathname}`);
    } else {
      console.log(`[Auth] No session found - Route: ${routeId} - Path: ${pathname}`);
    }

    if (event.route.id?.startsWith("/(auth)/")) {
      if (session) {
        console.log(`[Auth] Redirecting authenticated user from auth route to home - User: ${session.user.email}`);
        return redirect(307, "/");
      }
    } else if (event.route.id?.startsWith("/(protected)/")) {
      if (!session) {
        console.log(`[Auth] Redirecting unauthenticated user from protected route to login - Route: ${routeId}`);
        return redirect(307, "/login");
      }
    }
  } catch (error) {
    console.error(`[Auth] Error during authentication check - Route: ${routeId} - Path: ${pathname}`, error);
    // Continue without session if there's an error
    // This allows the request to proceed, but protected routes will still be handled by svelteKitHandler
  }

  return svelteKitHandler({ event, resolve, auth, building });
}
