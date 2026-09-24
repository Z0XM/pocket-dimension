/**
 * Resolve / upsert DB-backed connector settings for admin console + cron gate.
 * Env vars seed defaults when no row exists yet.
 */

import { db, schema } from "@pocket-dimension/db";
import { eq } from "drizzle-orm";

export const BUNKO_CONNECTOR_ID = "bunko";

export type BunkoSettings = {
  connectorId: string;
  enabled: boolean;
  cronExpression: string;
  pageSize: number;
  statusFilter: string;
  destinationUsername: string;
  catalogActorUsername: string;
};

function envDefaults(): BunkoSettings {
  const destination = (Bun.env.BUNKO_IMPORT_USERNAME || "lordsparos").toLowerCase();
  return {
    connectorId: BUNKO_CONNECTOR_ID,
    enabled: Bun.env.BUNKO_IMPORT_ENABLED === "true" || Bun.env.BUNKO_IMPORT_ENABLED === "1",
    cronExpression: Bun.env.BUNKO_IMPORT_CRON || "0 6 * * *",
    pageSize: Number(Bun.env.BUNKO_PAGE_SIZE || 100) || 100,
    statusFilter: Bun.env.BUNKO_STATUS_FILTER || "",
    destinationUsername: destination,
    catalogActorUsername: (Bun.env.BUNKO_CATALOG_ACTOR_USERNAME || destination).toLowerCase(),
  };
}

export async function getBunkoSettings(): Promise<BunkoSettings> {
  const defaults = envDefaults();
  const [row] = await db
    .select()
    .from(schema.connectorSettings)
    .where(eq(schema.connectorSettings.connectorId, BUNKO_CONNECTOR_ID))
    .limit(1);

  if (!row) return defaults;

  return {
    connectorId: BUNKO_CONNECTOR_ID,
    enabled: row.enabled,
    cronExpression: row.cronExpression?.trim() || defaults.cronExpression,
    pageSize: row.pageSize && row.pageSize > 0 ? row.pageSize : defaults.pageSize,
    statusFilter: row.statusFilter ?? defaults.statusFilter,
    destinationUsername: (row.destinationUsername || defaults.destinationUsername).toLowerCase(),
    catalogActorUsername: (row.catalogActorUsername || row.destinationUsername || defaults.catalogActorUsername).toLowerCase(),
  };
}

export type BunkoSettingsPatch = Partial<{
  enabled: boolean;
  cronExpression: string | null;
  pageSize: number | null;
  statusFilter: string | null;
  destinationUsername: string | null;
  catalogActorUsername: string | null;
}>;

export async function upsertBunkoSettings(patch: BunkoSettingsPatch): Promise<BunkoSettings> {
  const current = await getBunkoSettings();
  const next = {
    enabled: patch.enabled ?? current.enabled,
    cronExpression: patch.cronExpression === undefined ? current.cronExpression : patch.cronExpression?.trim() || current.cronExpression,
    pageSize: patch.pageSize === undefined || patch.pageSize === null ? current.pageSize : patch.pageSize,
    statusFilter: patch.statusFilter === undefined ? current.statusFilter : (patch.statusFilter ?? ""),
    destinationUsername:
      patch.destinationUsername === undefined
        ? current.destinationUsername
        : (patch.destinationUsername || current.destinationUsername).toLowerCase(),
    catalogActorUsername:
      patch.catalogActorUsername === undefined
        ? current.catalogActorUsername
        : (patch.catalogActorUsername || current.catalogActorUsername).toLowerCase(),
  };

  const now = new Date();
  const [existing] = await db
    .select()
    .from(schema.connectorSettings)
    .where(eq(schema.connectorSettings.connectorId, BUNKO_CONNECTOR_ID))
    .limit(1);

  if (existing) {
    await db
      .update(schema.connectorSettings)
      .set({
        ...next,
        updatedAt: now,
      })
      .where(eq(schema.connectorSettings.id, existing.id));
  } else {
    await db.insert(schema.connectorSettings).values({
      connectorId: BUNKO_CONNECTOR_ID,
      ...next,
      createdAt: now,
      updatedAt: now,
    });
  }

  return getBunkoSettings();
}

/** List settings rows for all known integrators (seed bunko defaults if missing). */
export async function listConnectorSettingsForAdmin() {
  const bunko = await getBunkoSettings();
  const rows = await db.select().from(schema.connectorSettings);
  const byId = new Map(rows.map((r) => [r.connectorId, r]));

  return [
    {
      ...bunko,
      persisted: byId.has(BUNKO_CONNECTOR_ID),
    },
  ];
}
