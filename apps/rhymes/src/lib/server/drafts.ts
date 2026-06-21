import { db, schema } from "@pocket-dimension/db";
import type { ContentType } from "$lib/rhymes";

const CONTENT_TYPES: ContentType[] = ["poem", "article", "song", "diary"];

export interface CreateDraftInput {
  body: string;
  contentType?: ContentType;
}

export interface CreatedDraftPiece {
  id: string;
  slug: string;
  title: string;
  status: "draft";
  visibility: "hidden";
  contentType: ContentType;
}

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

export async function createDraftPiece(userId: string, input: CreateDraftInput): Promise<CreatedDraftPiece> {
  const bodyPlain = normalizeDraftBody(input.body);

  if (!bodyPlain) {
    throw new Error("Draft body cannot be empty");
  }

  const titleText = deriveDraftTitle(bodyPlain);
  const slug = deriveDraftSlug(titleText);
  const contentType = normalizeContentType(input.contentType);

  const [piece] = await db
    .insert(schema.rhymesPieces)
    .values({
      slug,
      contentType,
      status: "draft",
      visibility: "hidden",
      titleText,
      bodyPlain,
      defaultReaderMode: "continuous",
      authorId: userId,
      createdById: userId,
      updatedById: userId,
    })
    .returning({
      id: schema.rhymesPieces.id,
      slug: schema.rhymesPieces.slug,
      titleText: schema.rhymesPieces.titleText,
      status: schema.rhymesPieces.status,
      visibility: schema.rhymesPieces.visibility,
      contentType: schema.rhymesPieces.contentType,
    });

  return {
    id: piece.id,
    slug: piece.slug,
    title: piece.titleText,
    status: "draft",
    visibility: "hidden",
    contentType: piece.contentType,
  };
}
