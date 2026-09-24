import { error, json } from "@sveltejs/kit";
import { listConnectors, listIntegratorStubs } from "$lib/connectors";
import { listConnectorSettingsForAdmin, upsertBunkoSettings } from "$lib/connectors/jobs/connector-settings";
import { listConnectorRuns, runBunkoSync } from "$lib/connectors/jobs/bunko-sync";
import type { RequestHandler } from "./$types";

function requireAdmin(locals: App.Locals) {
  if (!locals.user) {
    throw error(401, { message: "Authentication required" });
  }
  if (locals.user.role !== "admin") {
    throw error(403, { message: "Admin role required" });
  }
  return locals.user;
}

export const GET: RequestHandler = async ({ locals, url }) => {
  requireAdmin(locals);
  const runsLimit = Number(url.searchParams.get("runsLimit") || 40) || 40;
  const [settings, runs] = await Promise.all([listConnectorSettingsForAdmin(), listConnectorRuns(undefined, runsLimit)]);

  return json({
    connectors: listConnectors(),
    integrators: listIntegratorStubs(),
    settings,
    runs,
  });
};

export const PATCH: RequestHandler = async ({ locals, request }) => {
  requireAdmin(locals);
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const connectorId = String(body.connectorId ?? "bunko");
  if (connectorId !== "bunko") {
    return json({ error: `Settings for ${connectorId} are not editable yet` }, { status: 400 });
  }

  const patch: Parameters<typeof upsertBunkoSettings>[0] = {};
  if (typeof body.enabled === "boolean") patch.enabled = body.enabled;
  if ("cronExpression" in body) patch.cronExpression = body.cronExpression == null ? null : String(body.cronExpression);
  if ("pageSize" in body) patch.pageSize = body.pageSize == null ? null : Number(body.pageSize);
  if ("statusFilter" in body) patch.statusFilter = body.statusFilter == null ? null : String(body.statusFilter);
  if ("destinationUsername" in body) {
    patch.destinationUsername = body.destinationUsername == null ? null : String(body.destinationUsername);
  }
  if ("catalogActorUsername" in body) {
    patch.catalogActorUsername = body.catalogActorUsername == null ? null : String(body.catalogActorUsername);
  }

  const settings = await upsertBunkoSettings(patch);
  return json({ ok: true, settings });
};

export const POST: RequestHandler = async ({ locals, request }) => {
  const user = requireAdmin(locals);
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(body.action || "sync");
  const connectorId = String(body.connectorId ?? "bunko");

  if (action !== "sync") {
    return json({ error: `Unknown action: ${action}` }, { status: 400 });
  }
  if (connectorId !== "bunko") {
    return json({ error: `Manual sync not implemented for ${connectorId}` }, { status: 400 });
  }

  try {
    const summary = await runBunkoSync({
      trigger: "manual",
      triggeredByUserId: user.id,
      force: true,
    });
    return json({ ok: true, summary });
  } catch (err: any) {
    return json({ ok: false, error: err?.message || "Sync failed" }, { status: 500 });
  }
};
