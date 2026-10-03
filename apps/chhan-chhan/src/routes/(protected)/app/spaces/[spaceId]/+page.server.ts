import { error } from "@sveltejs/kit";
import { getSpaceDetail } from "$lib/server/finance";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, parent, params }) => {
  if (!locals.user?.id) throw error(401, "Unauthorized");

  const { account } = await parent();
  const detail = await getSpaceDetail(account.id, params.spaceId);
  if (!detail) throw error(404, "Space not found");

  return {
    account,
    space: detail.space,
    transactions: detail.transactions,
    allocations: detail.allocations,
    settlementBatches: detail.settlementBatches,
    people: detail.people,
    items: detail.items,
    itemPayments: detail.itemPayments,
    personBalances: detail.personBalances,
    shareOpens: detail.shareOpens,
    itemOpens: detail.itemOpens,
  };
};
