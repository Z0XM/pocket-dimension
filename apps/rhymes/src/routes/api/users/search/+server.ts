import { json } from "@sveltejs/kit";
import { db, schema } from "@pocket-dimension/db";
import { ilike, or } from "drizzle-orm";
import { requireRhymesCreator } from "$lib/server/authz";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ locals, url }) => {
  await requireRhymesCreator(locals);

  const query = url.searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) {
    return json({ users: [] });
  }

  const pattern = `%${query}%`;
  const users = await db
    .select({
      id: schema.user.id,
      email: schema.user.email,
      name: schema.user.name,
      username: schema.user.username,
    })
    .from(schema.user)
    .where(or(ilike(schema.user.email, pattern), ilike(schema.user.name, pattern), ilike(schema.user.username, pattern)))
    .limit(10);

  return json({ users });
};
