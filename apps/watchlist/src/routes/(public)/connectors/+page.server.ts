import { listConnectors, listDatasets, listIntegratorStubs } from "$lib/connectors";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => {
  // Public page: strip admin/ops fields (trigger, scope, accountUsername, sync endpoints).
  const integrators = listIntegratorStubs().map(({ id, label, description, direction, status, homepage }) => ({
    id,
    label,
    description,
    direction,
    status,
    homepage,
  }));
  const connectors = listConnectors().map((c) => {
    if (c.kind !== "integrator") return c;
    const { trigger, scope, accountUsername, endpoints, ...rest } = c;
    return {
      ...rest,
      endpoints: endpoints
        ? {
            exportCsv: endpoints.exportCsv,
            importCsv: endpoints.importCsv,
            getJson: endpoints.getJson,
            postJson: endpoints.postJson,
          }
        : undefined,
    };
  });

  return {
    connectors,
    datasets: listDatasets(),
    integrators,
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
