import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

/** `/` is only a redirect; the app lives at `/app` inside `(protected)`. */
export const load: PageServerLoad = () => {
  redirect(307, "/app");
};
