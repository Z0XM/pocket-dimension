import type { IntegratorStub } from "../types";
import { INTEGRATORS } from "../registry";

/** Integrator stubs — real partner sync will replace these later. */
export function listIntegratorStubs(): IntegratorStub[] {
  return INTEGRATORS;
}

export function getIntegratorStub(id: string): IntegratorStub | undefined {
  return INTEGRATORS.find((i) => i.id === id);
}

export function assertIntegratorNotReady(id: string): never {
  const stub = getIntegratorStub(id);
  throw new Error(stub ? `${stub.label} integration is coming soon (skeleton only).` : `Unknown integrator: ${id}`);
}

export { fetchAllBunkoMovies } from "./bunko";
export {
  mapBunkoRows,
  mapBunkoType,
  mapBunkoStatus,
  mapBunkoRating,
  mapBunkoToCatalogRow,
  mapBunkoToRatingRow,
} from "./bunko-map";
