import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ url }) => {
  const target = new URL("/delivery", url.origin);
  target.searchParams.set("view", "timeline");

  const tree = url.searchParams.get("tree");
  if (tree) {
    target.searchParams.set("tree", tree);
  }

  redirect(307, `${target.pathname}${target.search}`);
};
