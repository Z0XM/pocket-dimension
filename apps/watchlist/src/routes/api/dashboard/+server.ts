import { getDashboardData, type DashboardScope } from "$lib/server/dashboard";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ url, locals }) => {
  const scopeParam = url.searchParams.get("scope");
  const scope: DashboardScope = scopeParam === "personal" ? "personal" : "catalog";

  const data = await getDashboardData(locals.user?.id, scope);
  return json(data);
};
