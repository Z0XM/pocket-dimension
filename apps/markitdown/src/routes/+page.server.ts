import { getSupportedFormats } from "$lib/server/markitdown";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = () => {
  return {
    supportedFormats: getSupportedFormats(),
  };
};
