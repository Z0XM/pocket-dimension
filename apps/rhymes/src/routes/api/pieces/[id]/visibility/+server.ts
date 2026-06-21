import { json, error } from "@sveltejs/kit";
import { requirePieceEditor } from "$lib/server/authz";
import { setPieceVisibility } from "$lib/server/pieces";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ locals, params, request }) => {
  const user = await requirePieceEditor(locals, params.id);

  let payload: { visibility?: unknown };
  try {
    payload = await request.json();
  } catch {
    throw error(400, "Invalid JSON body");
  }

  if (payload.visibility !== "public" && payload.visibility !== "hidden") {
    throw error(400, "Visibility must be public or hidden");
  }

  try {
    const piece = await setPieceVisibility(params.id, user.id, payload.visibility);
    return json({ piece, message: payload.visibility === "hidden" ? "Piece hidden" : "Piece visible again" });
  } catch (visibilityError) {
    if (visibilityError instanceof Error) {
      throw error(400, visibilityError.message);
    }
    throw error(500, "Failed to update visibility");
  }
};
