import { json } from "@sveltejs/kit";
import {
  assertCatalogWriteRole,
  assertDatasetAccess,
  exportCatalog,
  exportRatings,
  exportViews,
  importCatalog,
  importRatings,
  requireDataset,
  resolveConnectorUser,
} from "$lib/connectors";
import type { RequestHandler } from "./$types";

/** JSON GET /api/connectors/api/:dataset */
export const GET: RequestHandler = async ({ params, request, locals }) => {
  const dataset = requireDataset(params.dataset);
  const user = await resolveConnectorUser(request, locals.user);
  assertDatasetAccess(dataset, user, "export");

  let rows: unknown[] = [];
  if (dataset.id === "catalog") {
    rows = await exportCatalog();
  } else if (dataset.id === "ratings") {
    rows = await exportRatings(user!.id);
  } else if (dataset.id === "views") {
    rows = await exportViews(user!.id);
  }

  return json({
    dataset: dataset.id,
    access: dataset.access,
    columns: dataset.columns,
    count: rows.length,
    rows,
  });
};

/** JSON POST /api/connectors/api/:dataset — body: { rows: [...] } */
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

  let body: { rows?: Array<Record<string, unknown>> };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Expected JSON body with { rows: [...] }" }, { status: 400 });
  }

  const rows = Array.isArray(body.rows) ? body.rows : null;
  if (!rows) {
    return json({ error: "Expected JSON body with { rows: [...] }" }, { status: 400 });
  }

  const result = dataset.id === "catalog" ? await importCatalog(rows, user!.id) : await importRatings(rows, user!.id);
  return json(result);
};
