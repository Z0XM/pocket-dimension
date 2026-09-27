#!/usr/bin/env bun
/**
 * Import Legacy 2025 year-recap dashboards into Postgres (jsonb + bytea).
 *
 * Env:
 *   DATABASE_URL                 — required (or shared/db/.env)
 *   YEAR_RECAP_EXPORT_DIR        — year-recap/dashboard root (has src/data + public/drawings)
 *   YEAR_RECAP_EMAILS_FILE       — JSON map { "slug": "email@…" } (never commit)
 *
 * Example:
 *   YEAR_RECAP_EXPORT_DIR=/home/z0xm/year-recap/dashboard \
 *   YEAR_RECAP_EMAILS_FILE=./scripts/legacy-recap-emails.json \
 *   bun run scripts/import-legacy-recap-2025.ts
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { eq } from "drizzle-orm";
import { db, schema } from "@pocket-dimension/db";

const YEAR = 2025;
const { legacyRecapProfile, legacyRecapDrawing } = schema;

type DayEntry = {
  day_int: number;
  date: string;
  drawing_src: string | null;
  has_drawing?: boolean;
  [key: string]: unknown;
};

type UserRecapFile = {
  user: { id: string; display_name: string; accent_color: string };
  summary: {
    rank?: number;
    slug?: string;
    days_filled: number;
    months_filled: number;
    drawings_count?: number;
    first_date: string | null;
    last_date: string | null;
    avg_score: number | null;
    [key: string]: unknown;
  };
  days: DayEntry[];
  months: unknown[];
};

function requireEnv(name: string): string {
  const v = Bun.env[name]?.trim();
  if (!v) {
    console.error(`Missing required env: ${name}`);
    process.exit(1);
  }
  return v;
}

function loadEmails(path: string): Record<string, string> {
  const raw = JSON.parse(readFileSync(path, "utf8")) as unknown;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("YEAR_RECAP_EMAILS_FILE must be a JSON object { slug: email }");
  }
  const out: Record<string, string> = {};
  for (const [slug, email] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof email !== "string" || !email.includes("@")) {
      throw new Error(`Invalid email for slug ${slug}`);
    }
    out[slug] = email.trim().toLowerCase();
  }
  return out;
}

function isUserJson(name: string): boolean {
  if (!name.endsWith(".json")) return false;
  if (name.startsWith("index")) return false;
  if (name === "skipped-drawings.json") return false;
  return true;
}

function resolveDrawingPath(exportDir: string, drawingSrc: string): string | null {
  // Export paths look like "/drawings/slug/20250101.png"
  const rel = drawingSrc.replace(/^\//, "");
  const candidates = [join(exportDir, "public", rel), join(exportDir, rel), join(exportDir, "public", "drawings", rel.replace(/^drawings\//, ""))];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return null;
}

async function importOne(slug: string, filePath: string, emails: Record<string, string>, exportDir: string) {
  const email = emails[slug];
  if (!email) {
    console.warn(`SKIP ${slug}: no email in emails file`);
    return;
  }

  const recap = JSON.parse(readFileSync(filePath, "utf8")) as UserRecapFile;
  const summary = recap.summary;
  const rank = summary.rank ?? 999;
  const displayName = recap.user.display_name;
  const accentColor = recap.user.accent_color || "#214247";
  const legacyUserId = recap.user.id;

  const now = new Date();

  const [profile] = await db
    .insert(legacyRecapProfile)
    .values({
      createdAt: now,
      updatedAt: now,
      year: YEAR,
      slug,
      legacyUserId,
      displayName,
      accentColor,
      rank,
      daysFilled: summary.days_filled ?? 0,
      drawingsCount: summary.drawings_count ?? 0,
      monthsFilled: summary.months_filled ?? 0,
      avgScore: summary.avg_score != null ? String(summary.avg_score) : null,
      firstDate: summary.first_date,
      lastDate: summary.last_date,
      email,
      payload: { ...recap, days: [] }, // placeholder; replaced after drawings
    })
    .onConflictDoUpdate({
      target: [legacyRecapProfile.slug, legacyRecapProfile.year],
      set: {
        updatedAt: now,
        legacyUserId,
        displayName,
        accentColor,
        rank,
        daysFilled: summary.days_filled ?? 0,
        drawingsCount: summary.drawings_count ?? 0,
        monthsFilled: summary.months_filled ?? 0,
        avgScore: summary.avg_score != null ? String(summary.avg_score) : null,
        firstDate: summary.first_date,
        lastDate: summary.last_date,
        email,
      },
    })
    .returning();

  if (!profile) {
    console.error(`FAILED upsert profile ${slug}`);
    return;
  }

  const days: DayEntry[] = [];
  let drawingsOk = 0;
  let drawingsMiss = 0;

  for (const day of recap.days) {
    let drawingSrc: string | null = null;
    if (day.drawing_src) {
      const pngPath = resolveDrawingPath(exportDir, day.drawing_src);
      if (!pngPath) {
        drawingsMiss++;
        console.warn(`  missing PNG ${day.drawing_src}`);
      } else {
        const png = Buffer.from(readFileSync(pngPath));
        const [drawing] = await db
          .insert(legacyRecapDrawing)
          .values({
            createdAt: now,
            updatedAt: now,
            profileId: profile.id,
            dayInt: day.day_int,
            png,
            contentType: "image/png",
          })
          .onConflictDoUpdate({
            target: [legacyRecapDrawing.profileId, legacyRecapDrawing.dayInt],
            set: {
              updatedAt: now,
              png,
              contentType: "image/png",
            },
          })
          .returning({ id: legacyRecapDrawing.id });

        if (drawing) {
          drawingSrc = `/api/recap/2025/drawings/${drawing.id}`;
          drawingsOk++;
        }
      }
    }

    days.push({
      ...day,
      drawing_src: drawingSrc,
      has_drawing: !!drawingSrc,
    });
  }

  const payload = {
    ...recap,
    summary: { ...summary, slug, rank },
    days,
  };

  await db
    .update(legacyRecapProfile)
    .set({
      updatedAt: now,
      payload,
      drawingsCount: drawingsOk,
    })
    .where(eq(legacyRecapProfile.id, profile.id));

  console.log(`OK ${slug} rank=#${rank} days=${days.length} drawings=${drawingsOk}` + (drawingsMiss ? ` miss=${drawingsMiss}` : ""));
}

async function main() {
  const exportDir = resolve(requireEnv("YEAR_RECAP_EXPORT_DIR"));
  const emailsFile = resolve(requireEnv("YEAR_RECAP_EMAILS_FILE"));
  const dataDir = join(exportDir, "src", "data");

  if (!existsSync(dataDir)) {
    console.error(`Data dir not found: ${dataDir}`);
    process.exit(1);
  }
  if (!existsSync(emailsFile)) {
    console.error(`Emails file not found: ${emailsFile}`);
    process.exit(1);
  }

  const emails = loadEmails(emailsFile);
  const files = readdirSync(dataDir).filter(isUserJson).sort();

  console.log(`Importing ${files.length} profiles from ${dataDir}`);
  console.log(`Emails map: ${Object.keys(emails).length} entries`);

  for (const file of files) {
    const slug = file.replace(/\.json$/, "");
    await importOne(slug, join(dataDir, file), emails, exportDir);
  }

  // fingerprint to confirm re-run safety (no secrets)
  const fingerprint = createHash("sha256").update(files.join("|")).digest("hex").slice(0, 12);
  console.log(`Done. fingerprint=${fingerprint}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
