import { json, error } from "@sveltejs/kit";
import { db, schema } from "@pocket-dimension/db";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { requirePieceEditor } from "$lib/server/authz";
import { updatePiece } from "$lib/server/pieces";
import { logPieceEvent } from "$lib/server/events";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ locals, request }) => {
  const formData = await request.formData();
  const pieceId = formData.get("pieceId");
  const file = formData.get("file");

  if (typeof pieceId !== "string" || !(file instanceof File)) {
    throw error(400, "pieceId and file are required");
  }

  const user = await requirePieceEditor(locals, pieceId);
  const uploadsDir = path.join(process.cwd(), "static", "uploads", "rhymes");
  await mkdir(uploadsDir, { recursive: true });

  const storageKey = `${pieceId}-${crypto.randomUUID()}-${file.name}`;
  const destination = path.join(uploadsDir, storageKey);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(destination, buffer);

  const [asset] = await db
    .insert(schema.rhymesAssets)
    .values({
      pieceId,
      kind: "title_art",
      storageKey,
      mimeType: file.type || "application/octet-stream",
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
    url: `/uploads/rhymes/${storageKey}`,
  });
};
