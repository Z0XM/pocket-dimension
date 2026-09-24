/**
 * In-process Bunko cron (howwasyourday notification-scheduler pattern).
 * Gated by BUNKO_IMPORT_ENABLED / connector_settings.enabled and BUNKO_IMPORT_CRON_ENABLED.
 */

import cron from "node-cron";
import { getBunkoSettings } from "./connector-settings";
import { runBunkoSync } from "./bunko-sync";

let started = false;
let task: cron.ScheduledTask | null = null;
let currentExpr: string | null = null;

function cronAllowedByEnv(): boolean {
  const master = Bun.env.BUNKO_IMPORT_ENABLED === "true" || Bun.env.BUNKO_IMPORT_ENABLED === "1";
  // Optional kill-switch for multi-instance: disable in-process schedule only
  if (Bun.env.BUNKO_IMPORT_CRON_ENABLED === "false" || Bun.env.BUNKO_IMPORT_CRON_ENABLED === "0") {
    return false;
  }
  return master;
}

async function tick() {
  try {
    const settings = await getBunkoSettings();
    if (!settings.enabled && !cronAllowedByEnv()) {
      return;
    }
    // Prefer DB enabled flag; env master still required for process to start scheduler
    if (!settings.enabled) {
      console.log("[bunko-scheduler] tick skipped — connector disabled in settings");
      return;
    }
    await runBunkoSync({ trigger: "cron" });
  } catch (error) {
    console.error("[bunko-scheduler] tick error:", error);
  }
}

/**
 * Start (or restart) the Bunko cron. Safe to call multiple times (singleton).
 * Requires BUNKO_IMPORT_ENABLED=true to register the schedule.
 */
export function startBunkoScheduler() {
  if (!cronAllowedByEnv()) {
    if (!started) {
      console.log("[bunko-scheduler] not started (set BUNKO_IMPORT_ENABLED=true; optional BUNKO_IMPORT_CRON_ENABLED=false to disable schedule only)");
    }
    return;
  }

  void (async () => {
    try {
      const settings = await getBunkoSettings();
      const expr = settings.cronExpression || "0 6 * * *";
      if (!cron.validate(expr)) {
        console.error(`[bunko-scheduler] invalid cron expression: ${expr}`);
        return;
      }

      if (started && task && currentExpr === expr) {
        return;
      }

      if (task) {
        task.stop();
        task = null;
      }

      task = cron.schedule(expr, () => {
        void tick();
      });
      started = true;
      currentExpr = expr;
      console.log(`[bunko-scheduler] started — cron "${expr}" (UTC). Multi-instance: set BUNKO_IMPORT_CRON_ENABLED=false on extra replicas.`);
    } catch (error) {
      console.error("[bunko-scheduler] failed to start:", error);
    }
  })();
}

export function isBunkoSchedulerStarted(): boolean {
  return started;
}
