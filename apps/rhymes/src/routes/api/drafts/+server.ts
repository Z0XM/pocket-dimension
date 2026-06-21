import { json, error } from "@sveltejs/kit";
import { requireRhymesCreator } from "$lib/server/authz";
import { createDraftPiece, normalizeContentType } from "$lib/server/pieces";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ locals, request }) => {
  const user = await requireRhymesCreator(locals);

  let payload: { body?: unknown; contentType?: unknown; sourceMode?: unknown };

  try {
    payload = await request.json();
  } catch {
    throw error(400, "Invalid JSON body");
  }

  if (typeof payload.body !== "string") {
    throw error(400, "Draft body is required");
  }

  try {
    const draft = await createDraftPiece(user.id, {
      body: payload.body,
      contentType: typeof payload.contentType === "string" ? normalizeContentType(payload.contentType) : undefined,
      sourceMode: typeof payload.sourceMode === "string" ? (payload.sourceMode as "plain" | "markdown" | "html") : undefined,
    });

    return json({
      id: draft.id,
      slug: draft.slug,
      title: draft.titleText,
      status: draft.status,
      visibility: draft.visibility,
      contentType: draft.contentType,
      message: "Draft saved",
    });
  } catch (createError) {
    if (createError instanceof Error && createError.message === "Draft body cannot be empty") {
      throw error(400, createError.message);
    }

    throw error(500, "Failed to save draft");
  }
};
