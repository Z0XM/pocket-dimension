import type { Rhyme } from "$lib/rhymes";
import { parseRhymes } from "$lib/rhymes";
import type { TitleRichStyle } from "$lib/document";
import { renderTitleStyle } from "$lib/document";
import { listPublicDbPieces, pieceToPages, type DbPiece } from "$lib/server/pieces";

function loadRawRhymeModules(): Record<string, string> {
  return import.meta.glob("../assets/rhymes/*.md", {
    eager: true,
    query: "?raw",
    import: "default",
  }) as Record<string, string>;
}

function deriveSummary(content: string): string {
  return (
    content
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.length > 0)
      ?.slice(0, 96) ?? ""
  );
}

export function dbPieceToRhyme(piece: DbPiece, titleArtUrl: string | null = null): Rhyme {
  const pages = pieceToPages(piece);
  const content = pages.join("\n\n---\n\n") || piece.bodyPlain;
  const publishedOrder = piece.publishedAt ? Math.floor(piece.publishedAt.getTime() / 1000) : 0;
  const legacy =
    piece.legacyMetadata && typeof piece.legacyMetadata === "object"
      ? (piece.legacyMetadata as Record<string, unknown>)
      : null;
  const legacyOrder = typeof legacy?.order === "number" ? legacy.order : undefined;

  return {
    id: `db:${piece.id}`,
    pieceId: piece.id,
    source: "database",
    slug: piece.slug,
    content,
    pages,
    contentType: piece.contentType,
    visibility: piece.status === "draft" ? "draft" : piece.visibility,
    defaultReaderMode: piece.defaultReaderMode,
    summary: deriveSummary(piece.bodyPlain),
    sourceMode: piece.sourceMode,
    bodyHtml: piece.bodyRenderHtml ?? undefined,
    creatorRating: piece.creatorRating,
    readerAverageRating: piece.readerAverageRating ? Number(piece.readerAverageRating) : null,
    readerRatingCount: piece.readerRatingCount,
    titleArtUrl,
    displayTitleMode: piece.displayTitleMode,
    titleRichJson: (piece.titleRichJson as TitleRichStyle | null) ?? null,
    titleStyle: renderTitleStyle((piece.titleRichJson as TitleRichStyle | null) ?? null),
    frontmatter: {
      title: piece.titleText,
      order: legacyOrder ?? publishedOrder,
      rating: piece.creatorRating ?? (piece.readerAverageRating ? Number(piece.readerAverageRating) : undefined),
      content_type: piece.contentType,
      visibility: piece.status === "draft" ? "draft" : piece.visibility,
      reader_mode: piece.defaultReaderMode,
      status: typeof legacy?.status === "string" ? legacy.status : piece.status === "published" ? "Published" : "Draft",
      thought_on: typeof legacy?.thought_on === "string" ? legacy.thought_on : undefined,
      phase: typeof legacy?.phase === "string" ? legacy.phase : undefined,
      tags: Array.isArray(legacy?.tags) ? (legacy.tags as string[]) : undefined,
    },
  };
}

export async function loadPublicCatalog(): Promise<Rhyme[]> {
  const useMarkdownCatalog = process.env.RHYMES_USE_MARKDOWN_CATALOG !== "false";
  const dbRows = await listPublicDbPieces();
  const dbRhymes = dbRows.map(({ piece, titleArtStorageKey }) =>
    dbPieceToRhyme(piece, titleArtStorageKey ? `/uploads/rhymes/${titleArtStorageKey}` : null)
  );

  if (!useMarkdownCatalog) {
    return dbRhymes.sort((a, b) => (b.frontmatter.order ?? 0) - (a.frontmatter.order ?? 0));
  }

  const markdownRhymes = parseRhymes(loadRawRhymeModules());
  const dbSlugs = new Set(dbRhymes.map((rhyme) => rhyme.slug));
  const markdownOnly = markdownRhymes.filter((rhyme) => !dbSlugs.has(rhyme.slug));

  return [...dbRhymes, ...markdownOnly].sort((a, b) => {
    const orderA = a.frontmatter.order ?? 0;
    const orderB = b.frontmatter.order ?? 0;
    return orderB - orderA;
  });
}

export async function findPublicCatalogRhymeBySlug(slug: string): Promise<Rhyme | undefined> {
  const catalog = await loadPublicCatalog();
  return catalog.find((rhyme) => rhyme.slug === slug);
}

export async function findReadableRhymeBySlug(
  slug: string,
  options: { includeHiddenForUserId?: string } = {}
): Promise<Rhyme | undefined> {
  const publicRhyme = await findPublicCatalogRhymeBySlug(slug);
  if (publicRhyme) return publicRhyme;

  if (!options.includeHiddenForUserId) return undefined;

  const { getPieceBySlug } = await import("$lib/server/pieces");
  const { canEditPiece } = await import("$lib/server/authz");
  const piece = await getPieceBySlug(slug);
  if (!piece || piece.status !== "published" || piece.visibility !== "hidden") return undefined;

  const allowed = await canEditPiece(options.includeHiddenForUserId, piece.id);
  if (!allowed) return undefined;

  return dbPieceToRhyme(piece);
}
