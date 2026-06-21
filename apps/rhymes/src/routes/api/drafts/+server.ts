import { json, error } from "@sveltejs/kit";
import { requireRhymesCreator } from "$lib/server/authz";
import { createDraftPiece, normalizeContentType } from "$lib/server/drafts";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ locals, request }) => {
  const user = requireRhymesCreator(locals);

  let payload: { body?: unknown; contentType?: unknown };

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
    });

    return json({
      ...draft,
      message: "Draft saved",
    });
  } catch (createError) {
    if (createError instanceof Error && createError.message === "Draft body cannot be empty") {
      throw error(400, createError.message);
    }

    throw error(500, "Failed to save draft");
  }
};
