import { createHash, randomBytes } from "node:crypto";
import { db, schema } from "@pocket-dimension/db";
import { and, desc, eq, isNull } from "drizzle-orm";

const TOKEN_PREFIX = "pd";
const TOKEN_SECRET_BYTES = 24;

export type ApiTokenRecord = typeof schema.apiToken.$inferSelect;
export type ApiTokenUser = typeof schema.user.$inferSelect;

export type ApiTokenPublic = {
  id: string;
  name: string;
  prefix: string;
  createdAt: Date;
  expiresAt: Date | null;
  revokedAt: Date | null;
  lastUsedAt: Date | null;
};

export type CreatedApiToken = ApiTokenPublic & {
  /** Raw token — only returned once at creation. */
  token: string;
};

export type ValidatedApiToken = {
  user: ApiTokenUser;
  apiToken: ApiTokenPublic;
};

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

function generateRawToken(): { raw: string; prefix: string; hash: string } {
  const secret = randomBytes(TOKEN_SECRET_BYTES).toString("base64url");
  const idPart = randomBytes(4).toString("hex");
  const prefix = `${TOKEN_PREFIX}_${idPart}`;
  const raw = `${prefix}_${secret}`;
  return { raw, prefix, hash: hashToken(raw) };
}

function toPublic(row: ApiTokenRecord): ApiTokenPublic {
  return {
    id: row.id,
    name: row.name,
    prefix: row.prefix,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt,
    lastUsedAt: row.lastUsedAt,
  };
}

function isExpired(expiresAt: Date | null | undefined, now = new Date()): boolean {
  return !!expiresAt && expiresAt.getTime() <= now.getTime();
}

/**
 * Create a long-lived API token for a user. Returns the raw token once.
 */
export async function createApiToken(input: { userId: string; name: string; expiresAt?: Date | null }): Promise<CreatedApiToken> {
  const name = input.name.trim();
  if (!name) {
    throw new Error("Token name is required");
  }
  if (name.length > 100) {
    throw new Error("Token name must be 100 characters or fewer");
  }

  const { raw, prefix, hash } = generateRawToken();
  const now = new Date();
  const [row] = await db
    .insert(schema.apiToken)
    .values({
      userId: input.userId,
      name,
      prefix,
      tokenHash: hash,
      expiresAt: input.expiresAt ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  if (!row) {
    throw new Error("Failed to create API token");
  }

  return { ...toPublic(row), token: raw };
}

/**
 * List API tokens for a user (metadata only — never the raw secret).
 */
export async function listApiTokens(userId: string): Promise<ApiTokenPublic[]> {
  const rows = await db.select().from(schema.apiToken).where(eq(schema.apiToken.userId, userId)).orderBy(desc(schema.apiToken.createdAt));

  return rows.map(toPublic);
}

/**
 * Revoke a token owned by the user. Idempotent if already revoked.
 */
export async function revokeApiToken(userId: string, tokenId: string): Promise<ApiTokenPublic | null> {
  const [existing] = await db
    .select()
    .from(schema.apiToken)
    .where(and(eq(schema.apiToken.id, tokenId), eq(schema.apiToken.userId, userId)))
    .limit(1);

  if (!existing) return null;
  if (existing.revokedAt) return toPublic(existing);

  const [row] = await db
    .update(schema.apiToken)
    .set({ revokedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(schema.apiToken.id, tokenId), eq(schema.apiToken.userId, userId)))
    .returning();

  return row ? toPublic(row) : null;
}

/**
 * Extract a bearer / x-api-key token from request headers.
 */
export function extractApiTokenFromHeaders(headers: Headers | Record<string, string | undefined>): string | null {
  const get = (key: string): string | null => {
    if (headers instanceof Headers) {
      return headers.get(key);
    }
    const lower = key.toLowerCase();
    for (const [k, v] of Object.entries(headers)) {
      if (k.toLowerCase() === lower && v) return v;
    }
    return null;
  };

  const apiKey = get("x-api-key");
  if (apiKey?.trim()) return apiKey.trim();

  const authorization = get("authorization");
  if (!authorization) return null;
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

/**
 * Validate a raw API token and return the owning user.
 * Updates lastUsedAt asynchronously (best-effort).
 */
export async function validateApiToken(rawToken: string): Promise<ValidatedApiToken | null> {
  const token = rawToken.trim();
  if (!token || !token.startsWith(`${TOKEN_PREFIX}_`)) return null;

  const hash = hashToken(token);
  const [row] = await db
    .select({
      apiToken: schema.apiToken,
      user: schema.user,
    })
    .from(schema.apiToken)
    .innerJoin(schema.user, eq(schema.apiToken.userId, schema.user.id))
    .where(and(eq(schema.apiToken.tokenHash, hash), isNull(schema.apiToken.revokedAt)))
    .limit(1);

  if (!row) return null;
  if (isExpired(row.apiToken.expiresAt)) return null;

  // Best-effort last-used stamp — do not block validation.
  void db
    .update(schema.apiToken)
    .set({ lastUsedAt: new Date(), updatedAt: new Date() })
    .where(eq(schema.apiToken.id, row.apiToken.id))
    .catch(() => undefined);

  return {
    user: row.user,
    apiToken: toPublic(row.apiToken),
  };
}

/**
 * Resolve a user from either a session cookie (via Better Auth getSession)
 * or an API token header. Prefer session when both are present.
 */
export async function resolveUserFromRequest(input: {
  headers: Headers;
  getSession: (args: { headers: Headers }) => Promise<{ user: ApiTokenUser } | null>;
}): Promise<{ user: ApiTokenUser; authMethod: "session" | "api_token" } | null> {
  const session = await input.getSession({ headers: input.headers });
  if (session?.user) {
    return { user: session.user, authMethod: "session" };
  }

  const raw = extractApiTokenFromHeaders(input.headers);
  if (!raw) return null;

  const validated = await validateApiToken(raw);
  if (!validated) return null;

  return { user: validated.user, authMethod: "api_token" };
}
