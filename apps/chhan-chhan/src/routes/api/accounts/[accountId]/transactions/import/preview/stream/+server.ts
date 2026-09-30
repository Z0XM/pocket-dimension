import { error } from "@sveltejs/kit";
import { canEdit, getMembershipOrThrow, requireUser } from "$lib/server/authz";
import { previewImportRows } from "$lib/server/import";
import { getImporter } from "$lib/importers";
import type { ImportPreviewStreamEvent } from "$lib/import-stream";

function streamLine(controller: ReadableStreamDefaultController<Uint8Array>, event: ImportPreviewStreamEvent) {
  const encoder = new TextEncoder();
  controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
}

export async function POST({ locals, params, request }) {
  const user = requireUser(locals);
  const membership = await getMembershipOrThrow(user.id, params.accountId);
  if (!canEdit(membership.role)) {
    throw error(403, "You only have read access");
  }

  const body = await request.formData();
  const file = body.get("file");
  if (!(file instanceof File)) {
    throw error(400, "Statement file is required as multipart field named 'file'");
  }

  const importerId = String(body.get("importer") ?? "kotak");
  const skipDuplicates = body.get("skipDuplicates") !== "false";

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        streamLine(controller, { type: "phase", phase: "parsing" });

        const importer = getImporter(importerId);
        const parsed = await importer.parse({
          fileName: file.name,
          mimeType: file.type,
          bytes: new Uint8Array(await file.arrayBuffer()),
        });

        if (!parsed.rows.length) {
          streamLine(controller, { type: "error", message: "No transactions found in statement" });
          controller.close();
          return;
        }

        streamLine(controller, { type: "phase", phase: "loading", total: parsed.rows.length });

        const preview = await previewImportRows(params.accountId, parsed.rows, {
          skipDuplicates,
          metadata: parsed.metadata,
          importerId,
          fileName: file.name,
          onProgress: (progress) => {
            streamLine(controller, { type: "progress", ...progress });
          },
        });

        streamLine(controller, { type: "preview", preview });
      } catch (cause) {
        streamLine(controller, {
          type: "error",
          message: cause instanceof Error ? cause.message : "Failed to preview statement",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
