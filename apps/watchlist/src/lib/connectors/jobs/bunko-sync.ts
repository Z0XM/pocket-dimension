/**
 * Bunko sync job: fetch → map → importCatalog → importRatings → persist run history.
 * Never auto-deletes local rows. Bunko wins on upsert (existing import semantics).
 */

import { db, schema } from "@pocket-dimension/db";
import { desc, eq } from "drizzle-orm";
import { importCatalog, importRatings } from "../datasets";
import { fetchAllBunkoMovies } from "../integrators/bunko";
import { mapBunkoRows } from "../integrators/bunko-map";
import type { ImportResult } from "../types";
import { BUNKO_CONNECTOR_ID, getBunkoSettings, type BunkoSettings } from "./connector-settings";

export type BunkoSyncTrigger = "cron" | "manual";

export type BunkoSyncOptions = {
  trigger: BunkoSyncTrigger;
  triggeredByUserId?: string | null;
  /** When true, run even if settings.enabled is false (manual admin/secret). */
  force?: boolean;
  settingsOverride?: Partial<BunkoSettings>;
};

export type BunkoSyncSummary = {
  runId: string;
  connectorId: string;
  trigger: BunkoSyncTrigger;
  status: "success" | "failure" | "partial";
  fetched: number;
  mapErrors: number;
  catalog: ImportResult;
  ratings: ImportResult;
  durationMs: number;
  destinationUsername: string;
  catalogActorUsername: string;
  errorSnippet: string | null;
};

async function resolveUserByUsername(username: string) {
  const [user] = await db
    .select({
      id: schema.user.id,
      username: schema.user.username,
      role: schema.user.role,
      emailVerified: schema.user.emailVerified,
    })
    .from(schema.user)
    .where(eq(schema.user.username, username.toLowerCase()))
    .limit(1);
  return user ?? null;
}

function snippetFromErrors(parts: string[], max = 500): string | null {
  const text = parts.filter(Boolean).join("; ").slice(0, max);
  return text || null;
}

export async function runBunkoSync(options: BunkoSyncOptions): Promise<BunkoSyncSummary> {
  const startedAt = new Date();
  const baseSettings = await getBunkoSettings();
  const settings: BunkoSettings = { ...baseSettings, ...options.settingsOverride };

  if (!options.force && !settings.enabled && options.trigger === "cron") {
    throw new Error("Bunko import is disabled (connector_settings.enabled / BUNKO_IMPORT_ENABLED)");
  }

  const [run] = await db
    .insert(schema.connectorRuns)
    .values({
      connectorId: BUNKO_CONNECTOR_ID,
      trigger: options.trigger,
      status: "running",
      startedAt,
      triggeredByUserId: options.triggeredByUserId ?? null,
      fetched: 0,
    })
    .returning();

  try {
    const destination = await resolveUserByUsername(settings.destinationUsername);
    if (!destination) {
      throw new Error(`Destination user not found: ${settings.destinationUsername}`);
    }
    if (!destination.emailVerified) {
      throw new Error(`Destination user email not verified: ${settings.destinationUsername}`);
    }

    let catalogActor = destination;
    if (settings.catalogActorUsername !== settings.destinationUsername) {
      const actor = await resolveUserByUsername(settings.catalogActorUsername);
      if (!actor) {
        throw new Error(`Catalog actor not found: ${settings.catalogActorUsername}`);
      }
      catalogActor = actor;
    }

    if (catalogActor.role !== "contributor" && catalogActor.role !== "admin") {
      throw new Error(
        `Catalog actor ${catalogActor.username} must be contributor or admin (got ${catalogActor.role})`
      );
    }

    const defaultLanguage = Bun.env.BUNKO_DEFAULT_LANGUAGE || "English";
    const baseUrl = Bun.env.BUNKO_BASE_URL || "https://bunko.byimti.tools";

    const { rows } = await fetchAllBunkoMovies({
      baseUrl,
      pageSize: settings.pageSize,
      statusFilter: settings.statusFilter || null,
    });

    const { catalog, ratings, mapErrors } = mapBunkoRows(rows, defaultLanguage);

    const catalogResult = await importCatalog(catalog as Array<Record<string, unknown>>, catalogActor.id);
    const ratingsResult = await importRatings(ratings as Array<Record<string, unknown>>, destination.id);

    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - startedAt.getTime();
    const totalErrors = mapErrors.length + catalogResult.errors.length + ratingsResult.errors.length;
    const hadWork = catalogResult.imported + catalogResult.updated + ratingsResult.imported + ratingsResult.updated > 0;
    const status: BunkoSyncSummary["status"] =
      totalErrors === 0 ? "success" : hadWork || catalog.length > 0 ? "partial" : "failure";

    const errorSnippet = snippetFromErrors([
      ...mapErrors.slice(0, 5).map((e) => `map[${e.index}]: ${e.message}`),
      ...catalogResult.errors.slice(0, 5).map((e) => `catalog row ${e.row}: ${e.message}`),
      ...ratingsResult.errors.slice(0, 5).map((e) => `ratings row ${e.row}: ${e.message}`),
    ]);

    const summaryPayload = {
      fetched: rows.length,
      mappedCatalog: catalog.length,
      mappedRatings: ratings.length,
      mapErrors: mapErrors.length,
      catalog: catalogResult,
      ratings: ratingsResult,
      durationMs,
      destinationUsername: settings.destinationUsername,
      catalogActorUsername: settings.catalogActorUsername,
    };

    await db
      .update(schema.connectorRuns)
      .set({
        status,
        finishedAt,
        durationMs,
        fetched: rows.length,
        catalogImported: catalogResult.imported,
        catalogUpdated: catalogResult.updated,
        catalogSkipped: catalogResult.skipped,
        ratingsImported: ratingsResult.imported,
        ratingsUpdated: ratingsResult.updated,
        ratingsSkipped: ratingsResult.skipped,
        errorCount: totalErrors,
        errorSnippet,
        summary: summaryPayload,
      })
      .where(eq(schema.connectorRuns.id, run.id));

    console.log(`[bunko-sync] ${status}`, summaryPayload);

    return {
      runId: run.id,
      connectorId: BUNKO_CONNECTOR_ID,
      trigger: options.trigger,
      status,
      fetched: rows.length,
      mapErrors: mapErrors.length,
      catalog: catalogResult,
      ratings: ratingsResult,
      durationMs,
      destinationUsername: settings.destinationUsername,
      catalogActorUsername: settings.catalogActorUsername,
      errorSnippet,
    };
  } catch (error: any) {
    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - startedAt.getTime();
    const message = error?.message || String(error);
    await db
      .update(schema.connectorRuns)
      .set({
        status: "failure",
        finishedAt,
        durationMs,
        errorCount: 1,
        errorSnippet: message.slice(0, 500),
        summary: { error: message },
      })
      .where(eq(schema.connectorRuns.id, run.id));

    console.error("[bunko-sync] failure", message);
    throw error;
  }
}

export async function listConnectorRuns(connectorId?: string, limit = 50) {
  const q = db
    .select()
    .from(schema.connectorRuns)
    .orderBy(desc(schema.connectorRuns.startedAt))
    .limit(limit);

  if (connectorId) {
    return db
      .select()
      .from(schema.connectorRuns)
      .where(eq(schema.connectorRuns.connectorId, connectorId))
      .orderBy(desc(schema.connectorRuns.startedAt))
      .limit(limit);
  }
  return q;
}

export async function getLatestBunkoRun() {
  const [row] = await db
    .select()
    .from(schema.connectorRuns)
    .where(eq(schema.connectorRuns.connectorId, BUNKO_CONNECTOR_ID))
    .orderBy(desc(schema.connectorRuns.startedAt))
    .limit(1);
  return row ?? null;
}
