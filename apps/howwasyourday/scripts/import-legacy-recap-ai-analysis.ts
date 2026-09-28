#!/usr/bin/env bun
/**
 * Upsert subagent-written AI analysis JSON into legacy_recap_ai_analysis.
 *
 * Reads: apps/howwasyourday/scripts/ai-out/*.json
 *
 *   bun run import:legacy-recap-ai-analysis
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@pocket-dimension/db";
import { AI_PROMPT_VERSION, validateAiOutFile } from "../src/lib/legacy-recap/ai-analysis";

const YEAR = 2025;
const IN_DIR = join(import.meta.dir, "ai-out");

async function main() {
  if (!existsSync(IN_DIR)) {
    console.error(`Missing directory ${IN_DIR} — create it and add <slug>.json files`);
    process.exit(1);
  }

  const files = readdirSync(IN_DIR).filter((n) => n.endsWith(".json"));
  if (!files.length) {
    console.error(`No JSON files in ${IN_DIR}`);
    process.exit(1);
  }

  let ok = 0;
  let fail = 0;

  for (const name of files) {
    const path = join(IN_DIR, name);
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(path, "utf8"));
    } catch (err) {
      console.warn(`FAIL ${name}: invalid JSON`, err);
      fail++;
      continue;
    }

    const validated = validateAiOutFile(raw);
    if (!validated.ok) {
      console.warn(`FAIL ${name}: ${validated.error}`);
      fail++;
      continue;
    }

    const file = validated.value;
    const slugFromFile = name.replace(/\.json$/, "");
    if (slugFromFile !== file.slug) {
      console.warn(`FAIL ${name}: slug "${file.slug}" does not match filename`);
      fail++;
      continue;
    }

    const profiles = await db
      .select({ id: schema.legacyRecapProfile.id })
      .from(schema.legacyRecapProfile)
      .where(and(eq(schema.legacyRecapProfile.slug, file.slug), eq(schema.legacyRecapProfile.year, YEAR)))
      .limit(1);

    const profile = profiles[0];
    if (!profile) {
      console.warn(`FAIL ${name}: no legacy_recap_profile for slug ${file.slug}`);
      fail++;
      continue;
    }

    const now = new Date();
    const existing = await db
      .select({ id: schema.legacyRecapAiAnalysis.id })
      .from(schema.legacyRecapAiAnalysis)
      .where(eq(schema.legacyRecapAiAnalysis.profileId, profile.id))
      .limit(1);

    if (existing[0]) {
      await db
        .update(schema.legacyRecapAiAnalysis)
        .set({
          updatedAt: now,
          year: YEAR,
          modelLabel: file.modelLabel,
          promptVersion: AI_PROMPT_VERSION,
          inputFingerprint: file.inputFingerprint,
          analysis: file.analysis,
          status: "ready",
          error: null,
        })
        .where(eq(schema.legacyRecapAiAnalysis.id, existing[0].id));
    } else {
      await db.insert(schema.legacyRecapAiAnalysis).values({
        createdAt: now,
        updatedAt: now,
        profileId: profile.id,
        year: YEAR,
        modelLabel: file.modelLabel,
        promptVersion: AI_PROMPT_VERSION,
        inputFingerprint: file.inputFingerprint,
        analysis: file.analysis,
        status: "ready",
        error: null,
      });
    }

    console.log(`OK ${file.slug}`);
    ok++;
  }

  console.log(`Imported ${ok} ready; ${fail} failed`);
  if (fail && !ok) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
