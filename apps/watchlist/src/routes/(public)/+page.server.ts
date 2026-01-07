import { db, schema } from "@pocket-dimension/db";
import { getWatchlistForUser } from "$lib/server/watchlist";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => {
  const user = locals.user;

  const { watchItems } = await getWatchlistForUser(user, { pageIndex: 0 });

  const languages = await db
    .select({
      id: schema.watchLanguages.id,
      name: schema.watchLanguages.language,
    })
    .from(schema.watchLanguages);

  const tags = await db
    .select({
      id: schema.watchTags.id,
      name: schema.watchTags.name,
    })
    .from(schema.watchTags);

  return {
    watchItems,
    languages,
    tags,
  };
};
