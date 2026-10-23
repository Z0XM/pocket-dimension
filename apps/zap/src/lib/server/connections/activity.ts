import { db, schema } from "@pocket-dimension/db";
import { and, desc, eq } from "drizzle-orm";

export type ConnectionProvider = "discord" | "spotify" | "youtube";

export async function logConnectionActivity(opts: {
  userId: string;
  provider: ConnectionProvider;
  kind: string;
  summary: string;
  meta?: Record<string, unknown>;
}) {
  try {
    await db.insert(schema.connectionActivity).values({
      userId: opts.userId,
      provider: opts.provider,
      kind: opts.kind,
      summary: opts.summary,
      metaJson: opts.meta ? JSON.stringify(opts.meta) : null,
    });
  } catch (err) {
    console.warn("[zap connections] activity log failed", err);
  }
}

export async function listConnectionActivity(opts: {
  userId: string;
  provider: ConnectionProvider;
  limit?: number;
}) {
  const limit = Math.min(Math.max(opts.limit ?? 40, 1), 100);
  try {
    const rows = await db.query.connectionActivity.findMany({
      where: and(eq(schema.connectionActivity.userId, opts.userId), eq(schema.connectionActivity.provider, opts.provider)),
      orderBy: [desc(schema.connectionActivity.createdAt)],
      limit,
    });
    return rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      summary: r.summary,
      meta: parseMeta(r.metaJson),
      at: r.createdAt.toISOString(),
    }));
  } catch (err) {
    // Table comes from migration 0060_zap_connections — missing migrate must not 500 /connections.
    console.warn("[zap connections] connection_activity unavailable (apply migration 0060?)", err);
    return [];
  }
}

function parseMeta(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as unknown;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
