import { json } from "@sveltejs/kit";
import { listConnectors, listDatasets, listIntegratorStubs } from "$lib/connectors";
import type { RequestHandler } from "./$types";

/** Public catalog of available connectors and datasets (no private data). */
export const GET: RequestHandler = async () => {
  return json({
    connectors: listConnectors(),
    datasets: listDatasets(),
    integrators: listIntegratorStubs(),
    auth: {
      tokensUrl: "/api-tokens",
      header: "Authorization: Bearer <token>  or  X-Api-Key: <token>",
      note: "Create/list/revoke tokens via auth-service while signed in. Private datasets require a verified account + token (or session cookie).",
    },
  });
};
