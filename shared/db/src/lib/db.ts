import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { schema } from "../schema";
import { env } from "./env";

let _db: NodePgDatabase<typeof schema> | null = null;

function getDb() {
  if (!_db) {
    const pool = new Pool({
      connectionString: env.DATABASE_URL,
    });
    _db = drizzle(pool, { schema, casing: "snake_case" });
  }
  return _db;
}

export const db = new Proxy({} as NodePgDatabase<typeof schema>, {
  get(_, prop) {
    const instance = getDb();
    const value = instance[prop as keyof typeof instance];
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
