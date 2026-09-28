#!/usr/bin/env bun
/**
 * Export safer-subset AI briefing packs for each legacy recap profile.
 *
 * Writes: apps/howwasyourday/scripts/ai-briefs/<slug>.json (gitignored)
 *
 *   bun run build:legacy-recap-ai-briefs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { db, schema } from "@pocket-dimension/db";
import { buildAiBrief } from "../src/lib/legacy-recap/ai-analysis";
import type { UserRecap } from "../src/lib/legacy-recap/types";

const YEAR = 2025;
const OUT_DIR = join(import.meta.dir, "ai-briefs");

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const rows = await db
    .select({
      slug: schema.legacyRecapProfile.slug,
      payload: schema.legacyRecapProfile.payload,
    })
    .from(schema.legacyRecapProfile)
    .where(eq(schema.legacyRecapProfile.year, YEAR));

  if (!rows.length) {
    console.error("No legacy_recap_profile rows for", YEAR);
    process.exit(1);
  }

  let n = 0;
  for (const row of rows) {
    const slug = row.slug;
    const recap = row.payload as UserRecap;
    if (!recap?.days || !recap?.user) {
      console.warn(`SKIP ${slug}: invalid payload`);
      continue;
    }
    const brief = buildAiBrief(recap, slug, YEAR);
    const path = join(OUT_DIR, `${slug}.json`);
    writeFileSync(path, `${JSON.stringify(brief, null, 2)}\n`, "utf8");
    console.log(`OK ${slug} → ${path} (fp ${brief.fingerprint})`);
    n++;
  }
  console.log(`Wrote ${n} briefing packs to ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
