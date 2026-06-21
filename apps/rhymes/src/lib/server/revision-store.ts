import { db, schema } from "@pocket-dimension/db";
import { desc, eq } from "drizzle-orm";
import type { BodyDocument, SourceMode, TitleRichStyle } from "$lib/document";
import { documentToHtml, documentToPlainTextWithBreaks } from "$lib/document";
import { logPieceEvent } from "$lib/server/events";
import { getPieceById, type DbPiece } from "$lib/server/pieces";
import { renderSourceToHtml } from "$lib/server/sanitize";

export interface PieceRevisionSnapshot {
  titleText: string;
  bodyPlain: string;
  bodyDocument: BodyDocument | null;
  bodyRenderHtml: string | null;
  sourceMode: SourceMode;
  titleRichJson: TitleRichStyle | null;
  displayTitleMode: "text" | "art";
  defaultReaderMode: "continuous" | "paged";
  creatorRating: number | null;
  contentType: "poem" | "article" | "song" | "diary";
}

export function pieceToRevisionSnapshot(piece: DbPiece): PieceRevisionSnapshot {
  return {
    titleText: piece.titleText,
    bodyPlain: piece.bodyPlain,
    bodyDocument: (piece.bodyDocument as BodyDocument | null) ?? null,
    bodyRenderHtml: piece.bodyRenderHtml,
    sourceMode: piece.sourceMode,
    titleRichJson: (piece.titleRichJson as TitleRichStyle | null) ?? null,
    displayTitleMode: piece.displayTitleMode,
    defaultReaderMode: piece.defaultReaderMode,
    creatorRating: piece.creatorRating,
    contentType: piece.contentType,
  };
}

export async function createPieceRevision(piece: DbPiece, actorId: string, label?: string) {
  const [revision] = await db
    .insert(schema.rhymesPieceRevisions)
    .values({
      pieceId: piece.id,
      actorId,
      snapshotJson: pieceToRevisionSnapshot(piece),
      label: label ?? null,
    })
    .returning();

  return revision;
}

export async function listPieceRevisions(pieceId: string, limit = 25) {
  return db
    .select()
    .from(schema.rhymesPieceRevisions)
    .where(eq(schema.rhymesPieceRevisions.pieceId, pieceId))
    .orderBy(desc(schema.rhymesPieceRevisions.createdAt))
    .limit(limit);
}

export async function getPieceRevision(pieceId: string, revisionId: string) {
  const [revision] = await db
    .select()
    .from(schema.rhymesPieceRevisions)
    .where(eq(schema.rhymesPieceRevisions.id, revisionId))
    .limit(1);

  if (!revision || revision.pieceId !== pieceId) {
    return null;
  }

  return revision;
}

export async function restorePieceRevision(pieceId: string, revisionId: string, actorId: string) {
  const piece = await getPieceById(pieceId);
  if (!piece) throw new Error("Piece not found");

  const revision = await getPieceRevision(pieceId, revisionId);
  if (!revision) throw new Error("Revision not found");

  const snapshot = revision.snapshotJson as PieceRevisionSnapshot;
  await createPieceRevision(piece, actorId, `before-restore:${revisionId}`);

  const bodyDocument = snapshot.bodyDocument;
  const bodyPlain = snapshot.bodyPlain || (bodyDocument ? documentToPlainTextWithBreaks(bodyDocument) : "");
  const bodyRenderHtml =
    snapshot.bodyRenderHtml ??
    (bodyDocument ? documentToHtml(bodyDocument) : await renderSourceToHtml(bodyPlain, snapshot.sourceMode));

  const [updated] = await db
    .update(schema.rhymesPieces)
    .set({
      titleText: snapshot.titleText,
      bodyPlain,
      bodyDocument,
      bodyRenderHtml,
      sourceMode: snapshot.sourceMode,
      titleRichJson: snapshot.titleRichJson,
      displayTitleMode: snapshot.displayTitleMode,
      defaultReaderMode: snapshot.defaultReaderMode,
      creatorRating: snapshot.creatorRating,
      contentType: snapshot.contentType,
      updatedById: actorId,
    })
    .where(eq(schema.rhymesPieces.id, pieceId))
    .returning();

  await logPieceEvent(pieceId, actorId, "revision_restored", { revisionId });
  return updated;
}
