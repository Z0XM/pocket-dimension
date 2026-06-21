import { loadPublicCatalog } from "$lib/server/catalog";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async () => {
  return {
    rhymes: await loadPublicCatalog(),
  };
};
