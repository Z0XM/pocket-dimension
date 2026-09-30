import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

/** App home is the dashboard; transactions live at /app/transactions. */
export const load: PageServerLoad = async () => {
  redirect(307, "/app/dashboards");
};
