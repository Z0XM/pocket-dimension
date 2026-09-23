import { listConnectors, listDatasets, listIntegratorStubs } from "$lib/connectors";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => {
  return {
    connectors: listConnectors(),
    datasets: listDatasets(),
    integrators: listIntegratorStubs(),
    user: locals.user
      ? {
          id: locals.user.id,
          username: locals.user.username,
          emailVerified: locals.user.emailVerified,
          role: locals.user.role,
        }
      : null,
    authBaseUrl: Bun.env.PUBLIC_BASE_AUTH_URL ?? "http://localhost:5001",
  };
};
