import { json } from "@sveltejs/kit";
import {
  assertCatalogWriteRole,
  assertDatasetAccess,
  exportCatalog,
  exportRatings,
  exportViews,
  importCatalog,
  importRatings,
  parseCsv,
  requireDataset,
  resolveConnectorUser,
  rowsToCsv,
} from "$lib/connectors";
import type { RequestHandler } from "./$types";

/** CSV export: GET /api/connectors/csv/:dataset */
export const GET: RequestHandler = async ({ params, request, locals }) => {
  const dataset = requireDataset(params.dataset);
  const user = await resolveConnectorUser(request, locals.user);
  assertDatasetAccess(dataset, user, "export");

  let rows: Array<Record<string, unknown>> = [];
  if (dataset.id === "catalog") {
    rows = await exportCatalog();
  } else if (dataset.id === "ratings") {
    rows = await exportRatings(user!.id);
  } else if (dataset.id === "views") {
    rows = await exportViews(user!.id);
  }

  const csv = rowsToCsv(dataset.columns, rows);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="watchlist-${dataset.id}.csv"`,
      "Cache-Control": "no-store",
    },
  });
};

/** CSV import: POST /api/connectors/csv/:dataset (multipart file or raw text/csv body) */
export const POST: RequestHandler = async ({ params, request, locals }) => {
  const dataset = requireDataset(params.dataset);
  const user = await resolveConnectorUser(request, locals.user);
  assertDatasetAccess(dataset, user, "import");

  if (dataset.id === "catalog") {
    assertCatalogWriteRole(user!);
  }
  if (dataset.id === "views") {
    return json({ error: "Views import is not supported yet" }, { status: 405 });
  }

  const contentType = request.headers.get("content-type") || "";
  let text = "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return json({ error: "Expected multipart field 'file'" }, { status: 400 });
    }
    text = await file.text();
  } else {
    text = await request.text();
  }

  if (!text.trim()) {
    return json({ error: "Empty CSV body" }, { status: 400 });
  }

  const { rows } = parseCsv(text);
  let result;
  if (dataset.id === "catalog") {
    result = await importCatalog(rows, user!.id);
  } else {
    result = await importRatings(rows, user!.id);
  }

  return json(result);
};
