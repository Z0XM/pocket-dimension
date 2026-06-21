import { json, error } from "@sveltejs/kit";
import { requireVerifiedUser } from "$lib/server/authz";
import { getPieceById } from "$lib/server/pieces";
import { getUserRatingForPiece, upsertReaderRating } from "$lib/server/ratings";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ locals, params }) => {
  const user = await requireVerifiedUser(locals);
  const piece = await getPieceById(params.id);

  if (!piece || piece.status !== "published" || piece.visibility !== "public") {
    throw error(404, "Piece not found");
  }

  const rating = await getUserRatingForPiece(params.id, user.id);
  return json({
    rating,
    readerAverageRating: piece.readerAverageRating ? Number(piece.readerAverageRating) : null,
    readerRatingCount: piece.readerRatingCount,
    creatorRating: piece.creatorRating,
  });
};

export const POST: RequestHandler = async ({ locals, params, request }) => {
  const user = await requireVerifiedUser(locals);
  const piece = await getPieceById(params.id);

  if (!piece || piece.status !== "published" || piece.visibility !== "public") {
    throw error(404, "Piece not found");
  }

  let payload: { rating?: unknown };
  try {
    payload = await request.json();
  } catch {
    throw error(400, "Invalid JSON body");
  }

  if (typeof payload.rating !== "number") {
    throw error(400, "Rating is required");
  }

  try {
    const result = await upsertReaderRating(params.id, user.id, payload.rating);
    return json(result);
  } catch (ratingError) {
    if (ratingError instanceof Error) {
      throw error(400, ratingError.message);
    }
    throw error(500, "Failed to save rating");
  }
};
