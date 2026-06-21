import { json, error } from "@sveltejs/kit";
import { db, schema } from "@pocket-dimension/db";
import { TITLE_ART_ENABLED } from "$lib/features";
import { requirePieceEditor } from "$lib/server/authz";
import { updatePiece } from "$lib/server/pieces";
import { logPieceEvent } from "$lib/server/events";
import { getAssetPublicUrl, uploadTitleArt } from "$lib/server/storage";
import type { RequestHandler } from "./$types";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

export const POST: RequestHandler = async ({ locals, request }) => {
  if (!TITLE_ART_ENABLED) {
    throw error(503, "Title art uploads are disabled");
  }

  const formData = await request.formData();
  const pieceId = formData.get("pieceId");
  const file = formData.get("file");

  if (typeof pieceId !== "string" || !(file instanceof File)) {
    throw error(400, "pieceId and file are required");
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw error(400, "Only PNG, JPEG, WebP, and GIF images are supported");
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    throw error(400, "Image must be 5MB or smaller");
  }

  const user = await requirePieceEditor(locals, pieceId);
  const storageKey = `${pieceId}-${crypto.randomUUID()}-${file.name}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = file.type || "application/octet-stream";

  await uploadTitleArt(storageKey, buffer, mimeType);

  const [asset] = await db
    .insert(schema.rhymesAssets)
    .values({
      pieceId,
      kind: "title_art",
      storageKey,
      mimeType,
      createdById: user.id,
      updatedById: user.id,
    })
    .returning();

  const piece = await updatePiece(pieceId, user.id, {
    titleArtAssetId: asset.id,
    displayTitleMode: "art",
  });

  await logPieceEvent(pieceId, user.id, "title_art_uploaded", { assetId: asset.id });

  return json({
    asset,
    piece,
    url: getAssetPublicUrl(storageKey),
  });
};
