import { loadPublicRhymes } from "$lib/loadRhymes";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = () => {
  return {
    rhymes: loadPublicRhymes(),
  };
};
