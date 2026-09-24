import { redirect } from "@sveltejs/kit";
import { listConnectors, listIntegratorStubs } from "$lib/connectors";
import { listConnectorSettingsForAdmin } from "$lib/connectors/jobs/connector-settings";
import { listConnectorRuns } from "$lib/connectors/jobs/bunko-sync";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) {
    throw redirect(307, "/login");
  }
  if (locals.user.role !== "admin") {
    throw redirect(307, "/connectors");
  }

  const [settings, runs] = await Promise.all([listConnectorSettingsForAdmin(), listConnectorRuns(undefined, 50)]);

  return {
    user: {
      id: locals.user.id,
      username: locals.user.username,
      role: locals.user.role,
    },
    connectors: listConnectors(),
    integrators: listIntegratorStubs(),
    settings,
    runs: runs.map((r) => ({
      id: r.id,
      connectorId: r.connectorId,
      trigger: r.trigger,
      status: r.status,
      startedAt: r.startedAt?.toISOString?.() ?? String(r.startedAt),
      finishedAt: r.finishedAt?.toISOString?.() ?? (r.finishedAt ? String(r.finishedAt) : null),
      durationMs: r.durationMs,
      fetched: r.fetched,
      catalogImported: r.catalogImported,
      catalogUpdated: r.catalogUpdated,
      catalogSkipped: r.catalogSkipped,
      ratingsImported: r.ratingsImported,
      ratingsUpdated: r.ratingsUpdated,
      ratingsSkipped: r.ratingsSkipped,
      errorCount: r.errorCount,
      errorSnippet: r.errorSnippet,
    })),
  };
};
