import { parseDeliveryView } from "$lib/catalog/delivery";
import { loadDeliveryForTree } from "$lib/server/load-delivery";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ parent, url }) => {
  const parentData = await parent();
  const view = parseDeliveryView(url.searchParams.get("view"));

  return {
    items: loadDeliveryForTree(parentData.tree, parentData.snapshot, parentData.snapshotError),
    view,
  };
};
