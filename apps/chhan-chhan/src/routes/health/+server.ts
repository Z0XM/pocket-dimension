import { json } from "@sveltejs/kit";
import { db } from "@pocket-dimension/db";
import { sql } from "drizzle-orm";

export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return json({ status: "ok" });
  } catch {
    return json({ status: "error", db: false }, { status: 503 });
  }
}
