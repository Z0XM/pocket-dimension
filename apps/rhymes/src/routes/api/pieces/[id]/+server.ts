import { json, error } from "@sveltejs/kit";
import { requirePieceEditor } from "$lib/server/authz";
import { getPieceById, publishPiece, updatePiece } from "$lib/server/pieces";
import { listPieceEvents } from "$lib/server/events";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ locals, params }) => {
  await requirePieceEditor(locals, params.id);
  const piece = await getPieceById(params.id);
  if (!piece) throw error(404, "Piece not found");
  return json({ piece });
};

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
  const user = await requirePieceEditor(locals, params.id);

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    throw error(400, "Invalid JSON body");
  }

  try {
    const piece = await updatePiece(params.id, user.id, {
      titleText: typeof payload.titleText === "string" ? payload.titleText : undefined,
      bodyPlain: typeof payload.bodyPlain === "string" ? payload.bodyPlain : undefined,
      contentType: typeof payload.contentType === "string" ? (payload.contentType as "poem") : undefined,
      sourceMode: typeof payload.sourceMode === "string" ? (payload.sourceMode as "plain") : undefined,
      defaultReaderMode:
        payload.defaultReaderMode === "paged" || payload.defaultReaderMode === "continuous"
          ? payload.defaultReaderMode
          : undefined,
      creatorRating:
        payload.creatorRating === null
          ? null
          : typeof payload.creatorRating === "number"
            ? payload.creatorRating
            : undefined,
      titleRichJson:
        payload.titleRichJson === null
          ? null
          : typeof payload.titleRichJson === "object"
            ? (payload.titleRichJson as import("$lib/document").TitleRichStyle)
            : undefined,
      displayTitleMode:
        payload.displayTitleMode === "text" || payload.displayTitleMode === "art" ? payload.displayTitleMode : undefined,
      titleArtAssetId:
        payload.titleArtAssetId === null
          ? null
          : typeof payload.titleArtAssetId === "string"
            ? payload.titleArtAssetId
            : undefined,
    });

    return json({ piece });
  } catch (updateError) {
    if (updateError instanceof Error) {
      throw error(400, updateError.message);
    }
    throw error(500, "Failed to update piece");
  }
};

export const POST: RequestHandler = async ({ locals, params, url }) => {
  const user = await requirePieceEditor(locals, params.id);
  const action = url.searchParams.get("action");

  if (action === "publish") {
    const piece = await publishPiece(params.id, user.id);
    return json({ piece, message: "Published" });
  }

  if (action === "history") {
    const events = await listPieceEvents(params.id);
    return json({ events });
  }

  throw error(400, "Unsupported action");
};
