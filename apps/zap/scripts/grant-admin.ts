/**
 * Bootstrap / manage Zap admins without the UI (e.g. the very first admin).
 * The account must already exist (sign up in Zap first). Needs DATABASE_URL.
 *
 * Usage (from apps/zap):
 *   bun run admin:grant you@example.com
 *   bun run admin:grant your-username --revoke
 *   bun run admin:grant --list
 */
import { db, schema } from "@pocket-dimension/db";
import { eq, ilike, or, sql } from "drizzle-orm";

const args = process.argv.slice(2);
const revoke = args.includes("--revoke");
const list = args.includes("--list");
const login = args.find((a) => !a.startsWith("--"))?.trim();

async function main() {
  if (list) {
    const rows = await db
      .select({ email: schema.user.email, username: schema.user.username, status: schema.userAccess.status })
      .from(schema.userAccess)
      .innerJoin(schema.user, eq(schema.user.id, schema.userAccess.userId))
      .where(eq(schema.userAccess.isAdmin, true));
    if (rows.length === 0) console.log("No Zap admins yet.");
    for (const r of rows) console.log(`${r.email}${r.username ? ` (${r.username})` : ""}`);
    return;
  }

  if (!login) {
    console.error("Usage: bun run admin:grant <email-or-username> [--revoke] | --list");
    process.exit(1);
  }

  const account = await db.query.user.findFirst({
    where: or(ilike(schema.user.email, login), ilike(schema.user.username, login)),
    columns: { id: true, email: true },
  });
  if (!account) {
    console.error(`No account matches "${login}". Sign up first, then re-run.`);
    process.exit(1);
  }

  const isAdmin = !revoke;
  await db
    .insert(schema.userAccess)
    .values({ userId: account.id, isAdmin })
    .onConflictDoUpdate({
      target: schema.userAccess.userId,
      set: {
        isAdmin,
        ...(isAdmin
          ? {
              status: sql`case when ${schema.userAccess.status} = 'blocked' then 'default'::zap.user_access_status else ${schema.userAccess.status} end`,
            }
          : {}),
        updatedAt: sql`now()`,
      },
    });
  console.log(`${account.email} is ${isAdmin ? "now" : "no longer"} a Zap admin.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
