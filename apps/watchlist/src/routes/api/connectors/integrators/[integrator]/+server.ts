import { json } from "@sveltejs/kit";
import { assertIntegratorNotReady, getIntegratorStub } from "$lib/connectors";
import type { RequestHandler } from "./$types";

/** Integrator stubs — always 501 until real integrations ship. */
export const GET: RequestHandler = async ({ params }) => {
  const stub = getIntegratorStub(params.integrator);
  if (!stub) {
    return json({ error: `Unknown integrator: ${params.integrator}` }, { status: 404 });
  }
  return json(
    {
      id: stub.id,
      label: stub.label,
      status: stub.status,
      message: `${stub.label} integration is a skeleton only. Real sync will land in a follow-up.`,
      homepage: stub.homepage,
    },
    { status: 501 }
  );
};

export const POST: RequestHandler = async ({ params }) => {
  try {
    assertIntegratorNotReady(params.integrator);
  } catch (error: any) {
    const stub = getIntegratorStub(params.integrator);
    if (!stub) {
      return json({ error: error?.message || "Unknown integrator" }, { status: 404 });
    }
    return json({ error: error?.message, status: "coming_soon" }, { status: 501 });
  }
};
