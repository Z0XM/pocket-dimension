import { json } from "@sveltejs/kit";
import { assertIntegratorNotReady, getIntegratorStub } from "$lib/connectors";
import { getBunkoSettings } from "$lib/connectors/jobs/connector-settings";
import { getLatestBunkoRun, runBunkoSync } from "$lib/connectors/jobs/bunko-sync";
import { resolveConnectorUser } from "$lib/connectors/auth";
import type { RequestHandler } from "./$types";

function authorizeBunkoSync(request: Request, user: { role?: string | null } | null): { ok: true } | { ok: false; status: number; error: string } {
  const secret = Bun.env.BUNKO_SYNC_SECRET;
  const authHeader = request.headers.get("authorization") || "";
  const bearer = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
  const headerSecret = request.headers.get("x-bunko-sync-secret") || "";

  if (secret && (bearer === secret || headerSecret === secret)) {
    return { ok: true };
  }

  if (user?.role === "admin") {
    return { ok: true };
  }

  if (!secret) {
    return { ok: false, status: 401, error: "Bunko sync requires admin session or BUNKO_SYNC_SECRET." };
  }
  return { ok: false, status: 401, error: "Unauthorized. Provide admin session or BUNKO_SYNC_SECRET." };
}

/** Integrator status — bunko returns live status; stubs return 501. */
export const GET: RequestHandler = async ({ params }) => {
  const stub = getIntegratorStub(params.integrator);
  if (!stub) {
    return json({ error: `Unknown integrator: ${params.integrator}` }, { status: 404 });
  }

  if (stub.id === "bunko") {
    const settings = await getBunkoSettings();
    const lastRun = await getLatestBunkoRun();
    return json({
      id: stub.id,
      label: stub.label,
      status: stub.status,
      homepage: stub.homepage,
      trigger: stub.trigger,
      scope: stub.scope,
      accountUsername: settings.destinationUsername,
      settings: {
        enabled: settings.enabled,
        cronExpression: settings.cronExpression,
        pageSize: settings.pageSize,
        statusFilter: settings.statusFilter,
        destinationUsername: settings.destinationUsername,
        catalogActorUsername: settings.catalogActorUsername,
      },
      lastRun: lastRun
        ? {
            id: lastRun.id,
            trigger: lastRun.trigger,
            status: lastRun.status,
            startedAt: lastRun.startedAt,
            finishedAt: lastRun.finishedAt,
            durationMs: lastRun.durationMs,
            fetched: lastRun.fetched,
            errorSnippet: lastRun.errorSnippet,
          }
        : null,
      endpoints: {
        sync: "POST /api/connectors/integrators/bunko",
      },
    });
  }

  return json(
    {
      id: stub.id,
      label: stub.label,
      status: stub.status,
      message: `${stub.label} integration is a skeleton only. Real sync will land in a follow-up.`,
      homepage: stub.homepage,
    },
    { status: 501 }
  );
};

/** Manual sync for bunko (secret and/or admin). Other integrators → 501. */
export const POST: RequestHandler = async ({ params, request, locals }) => {
  const stub = getIntegratorStub(params.integrator);
  if (!stub) {
    return json({ error: `Unknown integrator: ${params.integrator}` }, { status: 404 });
  }

  if (stub.id !== "bunko") {
    try {
      assertIntegratorNotReady(params.integrator);
    } catch (error: any) {
      return json({ error: error?.message, status: "coming_soon" }, { status: 501 });
    }
  }

  const user = await resolveConnectorUser(request, locals.user ?? null);
  const authz = authorizeBunkoSync(request, user);
  if (!authz.ok) {
    return json({ error: authz.error }, { status: authz.status });
  }

  try {
    const summary = await runBunkoSync({
      trigger: "manual",
      triggeredByUserId: user?.id ?? null,
      force: true,
    });
    return json({ ok: true, summary });
  } catch (error: any) {
    return json({ ok: false, error: error?.message || "Bunko sync failed" }, { status: 500 });
  }
};
