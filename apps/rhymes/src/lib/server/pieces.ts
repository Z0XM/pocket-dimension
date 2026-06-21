import { db, schema } from "@pocket-dimension/db";
import { and, desc, eq, sql } from "drizzle-orm";
import type { ContentType, ReaderMode } from "$lib/rhymes";
import { plainTextToDocument, documentToHtml, documentToPlainTextWithBreaks, splitDocumentPages } from "$lib/document";
import type { BodyDocument, SourceMode, TitleRichStyle } from "$lib/document";
import { renderSourceToHtml } from "$lib/server/sanitize";
import { logPieceEvent } from "$lib/server/events";
import { createPieceRevision } from "$lib/server/revision-store";

const CONTENT_TYPES: ContentType[] = ["poem", "article", "song", "diary"];
const SOURCE_MODES: SourceMode[] = ["plain", "markdown", "html"];

export interface CreateDraftInput {
  body: string;
  contentType?: ContentType;
  sourceMode?: SourceMode;
}

export interface UpdatePieceInput {
  titleText?: string;
  bodyPlain?: string;
  bodyDocument?: BodyDocument;
  contentType?: ContentType;
  sourceMode?: SourceMode;
  defaultReaderMode?: ReaderMode;
  creatorRating?: number | null;
  titleRichJson?: TitleRichStyle | null;
  displayTitleMode?: "text" | "art";
  titleArtAssetId?: string | null;
}

export type DbPiece = typeof schema.rhymesPieces.$inferSelect;

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function deriveDraftTitle(body: string): string {
  const firstLine =
    body
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? "";

  if (!firstLine) {
    return "Untitled draft";
  }

  return firstLine.length > 80 ? `${firstLine.slice(0, 77)}...` : firstLine;
}

export function deriveDraftSlug(title: string): string {
  const base = slugify(title).slice(0, 40) || "untitled-draft";
  const suffix = crypto.randomUUID().slice(0, 8);
  return `draft-${base}-${suffix}`;
}

export function derivePublishedSlug(title: string): string {
  const base = slugify(title).slice(0, 50) || "untitled";
  const suffix = crypto.randomUUID().slice(0, 6);
  return `${base}-${suffix}`;
}

export function normalizeDraftBody(body: string): string | null {
  const normalized = body.trim();
  return normalized.length > 0 ? normalized : null;
}

export function normalizeContentType(contentType: string | undefined): ContentType {
  if (contentType && CONTENT_TYPES.includes(contentType as ContentType)) {
    return contentType as ContentType;
  }

  return "poem";
}

export function normalizeSourceMode(sourceMode: string | undefined): SourceMode {
  if (sourceMode && SOURCE_MODES.includes(sourceMode as SourceMode)) {
    return sourceMode as SourceMode;
  }

  return "plain";
}

export function normalizeCreatorRating(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (!Number.isInteger(value) || value < 0 || value > 10) {
    throw new Error("Creator rating must be an integer between 0 and 10");
  }
  return value;
}

async function buildRenderPayload(bodyPlain: string, sourceMode: SourceMode, bodyDocument?: BodyDocument) {
  const document = bodyDocument ?? plainTextToDocument(bodyPlain);
  const normalizedPlain = bodyDocument ? documentToPlainTextWithBreaks(document) : bodyPlain;
  const bodyRenderHtml =
    sourceMode === "plain" && bodyDocument
      ? documentToHtml(document)
      : await renderSourceToHtml(normalizedPlain, sourceMode);
  return { bodyDocument: document, bodyPlain: normalizedPlain, bodyRenderHtml };
}

export async function createDraftPiece(userId: string, input: CreateDraftInput) {
  const bodyPlain = normalizeDraftBody(input.body);
  if (!bodyPlain) {
    throw new Error("Draft body cannot be empty");
  }

  const titleText = deriveDraftTitle(bodyPlain);
  const slug = deriveDraftSlug(titleText);
  const contentType = normalizeContentType(input.contentType);
  const sourceMode = normalizeSourceMode(input.sourceMode);
  const { bodyDocument, bodyRenderHtml } = await buildRenderPayload(bodyPlain, sourceMode);

  const [piece] = await db
    .insert(schema.rhymesPieces)
    .values({
      slug,
      contentType,
      status: "draft",
      visibility: "hidden",
      titleText,
      bodyPlain,
      sourceMode,
      bodyDocument,
      bodyRenderHtml,
      defaultReaderMode: "continuous",
      authorId: userId,
      createdById: userId,
      updatedById: userId,
    })
    .returning();

  await logPieceEvent(piece.id, userId, "created", { status: "draft" });
  return piece;
}

export async function publishPiece(pieceId: string, userId: string) {
  const piece = await getPieceById(pieceId);
  if (!piece) throw new Error("Piece not found");
  if (!piece.bodyPlain.trim()) throw new Error("Cannot publish an empty piece");

  const slug = piece.status === "published" ? piece.slug : derivePublishedSlug(piece.titleText);

  const [updated] = await db
    .update(schema.rhymesPieces)
    .set({
      slug,
      status: "published",
      visibility: "public",
      publishedAt: piece.publishedAt ?? sql`now()`,
      updatedById: userId,
    })
    .where(eq(schema.rhymesPieces.id, pieceId))
    .returning();

  await logPieceEvent(pieceId, userId, "published", { slug });
  return updated;
}

export async function publishDraftFromBody(userId: string, body: string, contentType?: ContentType) {
  const draft = await createDraftPiece(userId, { body, contentType });
  return publishPiece(draft.id, userId);
}

export async function setPieceVisibility(pieceId: string, userId: string, visibility: "public" | "hidden") {
  const piece = await getPieceById(pieceId);
  if (!piece) throw new Error("Piece not found");
  if (piece.status !== "published") throw new Error("Only published pieces can change visibility");

  const [updated] = await db
    .update(schema.rhymesPieces)
    .set({ visibility, updatedById: userId })
    .where(eq(schema.rhymesPieces.id, pieceId))
    .returning();

  await logPieceEvent(pieceId, userId, visibility === "hidden" ? "hidden" : "unhidden", { visibility });
  return updated;
}

export async function getPieceById(pieceId: string) {
  const [piece] = await db.select().from(schema.rhymesPieces).where(eq(schema.rhymesPieces.id, pieceId)).limit(1);
  return piece ?? null;
}

export async function getPieceBySlug(slug: string) {
  const [piece] = await db.select().from(schema.rhymesPieces).where(eq(schema.rhymesPieces.slug, slug)).limit(1);
  return piece ?? null;
}

export async function listCreatorPieces(userId: string) {
  return listEditablePieces(userId);
}

export async function listEditablePieces(userId: string) {
  const authored = await db
    .select()
    .from(schema.rhymesPieces)
    .where(eq(schema.rhymesPieces.authorId, userId))
    .orderBy(desc(schema.rhymesPieces.updatedAt));

  const shared = await db
    .select({ piece: schema.rhymesPieces })
    .from(schema.rhymesPiecePermissions)
    .innerJoin(schema.rhymesPieces, eq(schema.rhymesPiecePermissions.pieceId, schema.rhymesPieces.id))
    .where(eq(schema.rhymesPiecePermissions.userId, userId))
    .orderBy(desc(schema.rhymesPieces.updatedAt));

  const byId = new Map<string, DbPiece>();
  for (const piece of authored) byId.set(piece.id, piece);
  for (const { piece } of shared) byId.set(piece.id, piece);

  return Array.from(byId.values()).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

export async function listPublicDbPieces() {
  return db
    .select({
      piece: schema.rhymesPieces,
      titleArtStorageKey: schema.rhymesAssets.storageKey,
    })
    .from(schema.rhymesPieces)
    .leftJoin(schema.rhymesAssets, eq(schema.rhymesPieces.titleArtAssetId, schema.rhymesAssets.id))
    .where(and(eq(schema.rhymesPieces.status, "published"), eq(schema.rhymesPieces.visibility, "public")));
}

export async function updatePiece(pieceId: string, userId: string, input: UpdatePieceInput) {
  const piece = await getPieceById(pieceId);
  if (!piece) throw new Error("Piece not found");

  const hasContentChange =
    input.bodyPlain !== undefined || input.bodyDocument !== undefined || input.sourceMode !== undefined;
  if (hasContentChange || input.titleText !== undefined || input.titleRichJson !== undefined) {
    await createPieceRevision(piece, userId);
  }

  const updates: Partial<typeof schema.rhymesPieces.$inferInsert> = {
    updatedById: userId,
  };

  if (input.titleText !== undefined) updates.titleText = input.titleText.trim() || "Untitled";
  if (input.contentType !== undefined) updates.contentType = normalizeContentType(input.contentType);
  if (input.defaultReaderMode !== undefined) updates.defaultReaderMode = input.defaultReaderMode;
  if (input.creatorRating !== undefined) updates.creatorRating = normalizeCreatorRating(input.creatorRating);
  if (input.titleRichJson !== undefined) updates.titleRichJson = input.titleRichJson;
  if (input.displayTitleMode !== undefined) updates.displayTitleMode = input.displayTitleMode;
  if (input.titleArtAssetId !== undefined) updates.titleArtAssetId = input.titleArtAssetId;

  if (input.bodyDocument !== undefined) {
    const sourceMode = input.sourceMode ? normalizeSourceMode(input.sourceMode) : piece.sourceMode;
    const renderPayload = await buildRenderPayload(piece.bodyPlain, sourceMode, input.bodyDocument);
    updates.bodyPlain = renderPayload.bodyPlain;
    updates.sourceMode = sourceMode;
    updates.bodyDocument = renderPayload.bodyDocument;
    updates.bodyRenderHtml = renderPayload.bodyRenderHtml;
    if (!input.titleText) {
      updates.titleText = deriveDraftTitle(renderPayload.bodyPlain);
    }
  } else if (input.bodyPlain !== undefined) {
    const bodyPlain = normalizeDraftBody(input.bodyPlain);
    if (!bodyPlain) throw new Error("Body cannot be empty");
    const sourceMode = input.sourceMode ? normalizeSourceMode(input.sourceMode) : piece.sourceMode;
    const renderPayload = await buildRenderPayload(bodyPlain, sourceMode);
    updates.bodyPlain = bodyPlain;
    updates.sourceMode = sourceMode;
    updates.bodyDocument = renderPayload.bodyDocument;
    updates.bodyRenderHtml = renderPayload.bodyRenderHtml;
    if (!input.titleText) {
      updates.titleText = deriveDraftTitle(bodyPlain);
    }
  } else if (input.sourceMode !== undefined) {
    const sourceMode = normalizeSourceMode(input.sourceMode);
    const renderPayload = await buildRenderPayload(piece.bodyPlain, sourceMode, piece.bodyDocument as BodyDocument | undefined);
    updates.sourceMode = sourceMode;
    updates.bodyDocument = renderPayload.bodyDocument;
    updates.bodyRenderHtml = renderPayload.bodyRenderHtml;
  }

  const [updated] = await db.update(schema.rhymesPieces).set(updates).where(eq(schema.rhymesPieces.id, pieceId)).returning();
  await logPieceEvent(pieceId, userId, "updated", { fields: Object.keys(input) });
  return updated;
}

export function pieceToPages(piece: DbPiece): string[] {
  if (piece.bodyDocument && typeof piece.bodyDocument === "object") {
    const pages = splitDocumentPages(piece.bodyDocument as BodyDocument);
    if (pages.length > 0) return pages;
  }

  return piece.bodyPlain
    .split(/\n---\s*\n/)
    .map((page) => page.trim())
    .filter(Boolean);
}
