import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db, schema } from "@pocket-dimension/db";
import { eq, sql } from "drizzle-orm";
import { plainTextToDocument } from "../src/lib/document.ts";
import { parseAllRhymes, type ContentVisibility, type Rhyme } from "../src/lib/rhymes.ts";
import { renderSourceToHtml } from "../src/lib/server/sanitize.ts";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rhymesDir = path.join(scriptDir, "../src/assets/rhymes");

interface ImportSummary {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

function parseThoughtOnDate(thoughtOn: string | undefined): Date | null {
  if (!thoughtOn) return null;

  const normalized = thoughtOn.replaceAll("/", "-");
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeImportedRating(value: unknown): number | null {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  const rounded = Math.round(value);
  if (rounded < 0 || rounded > 10) return null;
  return rounded;
}

function mapPieceState(visibility: ContentVisibility): {
  status: "draft" | "published";
  visibility: "public" | "hidden";
} {
  if (visibility === "draft") {
    return { status: "draft", visibility: "hidden" };
  }

  if (visibility === "hidden") {
    return { status: "published", visibility: "hidden" };
  }

  return { status: "published", visibility: "public" };
}

async function loadMarkdownRhymes(): Promise<Rhyme[]> {
  const entries = await readdir(rhymesDir);
  const markdownFiles = entries.filter((name) => name.endsWith(".md"));
  const rawModules: Record<string, string> = {};

  for (const filename of markdownFiles) {
    const absolutePath = path.join(rhymesDir, filename);
    rawModules[`../assets/rhymes/${filename}`] = await readFile(absolutePath, "utf8");
  }

  return parseAllRhymes(rawModules);
}

async function resolveAuthorId(explicitAuthorId: string | undefined): Promise<string> {
  if (explicitAuthorId) {
    const [user] = await db.select().from(schema.user).where(eq(schema.user.id, explicitAuthorId)).limit(1);
    if (!user) {
      throw new Error(`RHYMES_IMPORT_AUTHOR_ID does not match a user: ${explicitAuthorId}`);
    }
    return user.id;
  }

  const [admin] = await db
    .select()
    .from(schema.user)
    .where(eq(schema.user.role, "admin"))
    .limit(1);

  if (admin) {
    return admin.id;
  }

  const [anyUser] = await db.select().from(schema.user).limit(1);
  if (!anyUser) {
    throw new Error("No auth users found. Create an admin user before importing rhymes markdown.");
  }

  return anyUser.id;
}

async function importRhyme(authorId: string, rhyme: Rhyme, dryRun: boolean): Promise<"created" | "updated" | "skipped"> {
  if (!rhyme.content.trim()) {
    return "skipped";
  }

  const pieceState = mapPieceState(rhyme.visibility);
  const bodyDocument = plainTextToDocument(rhyme.content);
  const bodyRenderHtml = await renderSourceToHtml(rhyme.content, "markdown");
  const thoughtOnDate = parseThoughtOnDate(rhyme.frontmatter.thought_on);
  const publishedAt =
    pieceState.status === "published"
      ? (thoughtOnDate ?? (rhyme.frontmatter.order ? new Date(rhyme.frontmatter.order * 1000) : new Date()))
      : null;

  const legacyMetadata = {
    sourcePath: rhyme.id,
    tags: rhyme.frontmatter.tags ?? [],
    thought_on: rhyme.frontmatter.thought_on ?? null,
    status: rhyme.frontmatter.status ?? null,
    phase: rhyme.frontmatter.phase ?? null,
    order: rhyme.frontmatter.order ?? null,
    importedAt: new Date().toISOString(),
  };

  const values = {
    slug: rhyme.slug,
    contentType: rhyme.contentType,
    status: pieceState.status,
    visibility: pieceState.visibility,
    titleText: rhyme.frontmatter.title ?? "Untitled",
    bodyPlain: rhyme.content,
    sourceMode: "markdown" as const,
    bodyDocument,
    bodyRenderHtml,
    defaultReaderMode: rhyme.defaultReaderMode,
    creatorRating: normalizeImportedRating(rhyme.frontmatter.rating),
    publishedAt,
    legacyMetadata,
    authorId,
    createdById: authorId,
    updatedById: authorId,
  };

  const [existing] = await db.select().from(schema.rhymesPieces).where(eq(schema.rhymesPieces.slug, rhyme.slug)).limit(1);

  if (dryRun) {
    return existing ? "updated" : "created";
  }

  if (existing) {
    await db
      .update(schema.rhymesPieces)
      .set({
        ...values,
        updatedAt: sql`now()`,
      })
      .where(eq(schema.rhymesPieces.id, existing.id));

    await db.insert(schema.rhymesPieceEvents).values({
      pieceId: existing.id,
      actorId: authorId,
      action: "import_updated",
      payloadJson: { slug: rhyme.slug, sourcePath: rhyme.id },
    });

    return "updated";
  }

  const [created] = await db.insert(schema.rhymesPieces).values(values).returning();

  await db.insert(schema.rhymesPieceEvents).values({
    pieceId: created.id,
    actorId: authorId,
    action: "imported",
    payloadJson: { slug: rhyme.slug, sourcePath: rhyme.id },
  });

  return "created";
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const authorId = await resolveAuthorId(process.env.RHYMES_IMPORT_AUTHOR_ID);
  const rhymes = await loadMarkdownRhymes();

  const summary: ImportSummary = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  console.log(`Importing ${rhymes.length} markdown pieces as author ${authorId}${dryRun ? " (dry run)" : ""}...`);

  for (const rhyme of rhymes) {
    try {
      const result = await importRhyme(authorId, rhyme, dryRun);
      summary[result] += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      summary.errors.push(`${rhyme.slug}: ${message}`);
    }
  }

  console.log(JSON.stringify(summary, null, 2));

  if (summary.errors.length > 0) {
    process.exitCode = 1;
  }
}

await main();
