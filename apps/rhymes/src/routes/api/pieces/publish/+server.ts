import { json, error } from "@sveltejs/kit";
import { requireRhymesCreator } from "$lib/server/authz";
import { publishDraftFromBody, normalizeContentType } from "$lib/server/pieces";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ locals, request }) => {
  const user = await requireRhymesCreator(locals);

  let payload: { body?: unknown; contentType?: unknown };

  try {
    payload = await request.json();
  } catch {
    throw error(400, "Invalid JSON body");
  }

  if (typeof payload.body !== "string") {
    throw error(400, "Body is required to publish");
  }

  try {
    const piece = await publishDraftFromBody(
      user.id,
      payload.body,
      typeof payload.contentType === "string" ? normalizeContentType(payload.contentType) : undefined
    );

    return json({
      id: piece.id,
      slug: piece.slug,
      title: piece.titleText,
      status: piece.status,
      visibility: piece.visibility,
      message: "Published",
    });
  } catch (publishError) {
    if (publishError instanceof Error && publishError.message.includes("empty")) {
      throw error(400, publishError.message);
    }

    throw error(500, "Failed to publish piece");
  }
};
