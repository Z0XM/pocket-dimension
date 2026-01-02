import { auth } from "@pocket-dimension/auth";
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
    event.locals.user = session.user;
  }

  if (event.route.id?.startsWith("/(auth)/")) {
    if (session) return redirect(307, "/");
  } else if (event.route.id?.startsWith("/(protected)/")) {
    if (!session) return redirect(307, "/login");
  }

  return svelteKitHandler({ event, resolve, auth, building });
}
