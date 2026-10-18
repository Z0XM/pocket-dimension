import { requireZapAdmin } from "$lib/server/admin/access";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ locals }) => {
  requireZapAdmin(locals);
  return {};
};
