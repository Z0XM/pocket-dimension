import { getDashboardData, type DashboardScope } from "$lib/server/dashboard";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, url }) => {
  const scopeParam = url.searchParams.get("scope");
  const scope: DashboardScope = scopeParam === "personal" ? "personal" : "catalog";

  try {
    const dashboard = await getDashboardData(locals.user?.id, scope);
    return {
      dashboard,
      isLoggedIn: !!locals.user,
    };
  } catch (error) {
    console.error("Error loading dashboard:", error);
    return {
      dashboard: null,
      isLoggedIn: !!locals.user,
    };
  }
};
