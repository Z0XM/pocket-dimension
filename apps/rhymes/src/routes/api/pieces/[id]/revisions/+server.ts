import { json, error } from "@sveltejs/kit";
import { listPieceRevisions, restorePieceRevision } from "$lib/server/revision-store";
import { requirePieceEditor } from "$lib/server/authz";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ locals, params }) => {
  await requirePieceEditor(locals, params.id);
  const revisions = await listPieceRevisions(params.id);
  return json({ revisions });
};

export const POST: RequestHandler = async ({ locals, params, request }) => {
  const user = await requirePieceEditor(locals, params.id);

  let payload: { revisionId?: unknown };
  try {
    payload = await request.json();
  } catch {
    throw error(400, "Invalid JSON body");
  }

  if (typeof payload.revisionId !== "string") {
    throw error(400, "revisionId is required");
  }

  try {
    const piece = await restorePieceRevision(params.id, payload.revisionId, user.id);
    return json({ piece, message: "Revision restored" });
  } catch (restoreError) {
    if (restoreError instanceof Error) {
      throw error(400, restoreError.message);
    }
    throw error(500, "Failed to restore revision");
  }
};
