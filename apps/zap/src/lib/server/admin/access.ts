import { db, schema } from "@pocket-dimension/db";
import { error } from "@sveltejs/kit";
import { desc, eq, ilike, or, sql } from "drizzle-orm";
import {
  parsePortalAccessMode,
  resolvePortalAccess,
  shouldTouchLastSeen,
  validateAccessChange,
  type PortalAccess,
  type PortalAccessMode,
  type UserAccessStatus,
} from "$lib/admin-access";
import { removeUserFromLiveSessions } from "$lib/server/sessions/sessions";

export type ZapAccess = {
  isAdmin: boolean;
  status: UserAccessStatus;
  mode: PortalAccessMode;
  access: PortalAccess;
};

export class AccessChangeError extends Error {
  constructor(
    message: string,
    readonly status: number = 400
  ) {
    super(message);
    this.name = "AccessChangeError";
  }
}

const ACCESS_MODE_KEY = "access_mode";
const MODE_CACHE_MS = 10_000;
let modeCache: { value: PortalAccessMode; at: number } | null = null;

export async function getPortalAccessMode(): Promise<PortalAccessMode> {
  if (modeCache && Date.now() - modeCache.at < MODE_CACHE_MS) return modeCache.value;
  const row = await db.query.zapSettings.findFirst({ where: eq(schema.zapSettings.key, ACCESS_MODE_KEY) });
  const value = parsePortalAccessMode(row?.value);
  modeCache = { value, at: Date.now() };
  return value;
}

export async function setPortalAccessMode(mode: PortalAccessMode, actorUserId: string) {
  await db
    .insert(schema.zapSettings)
    .values({ key: ACCESS_MODE_KEY, value: mode, updatedByUserId: actorUserId })
    .onConflictDoUpdate({
      target: schema.zapSettings.key,
      set: { value: mode, updatedByUserId: actorUserId, updatedAt: sql`now()` },
    });
  modeCache = { value: mode, at: Date.now() };
}

async function touchLastSeen(userId: string) {
  await db
    .insert(schema.userAccess)
    .values({ userId, firstSeenAt: sql`now()`, lastSeenAt: sql`now()` })
    .onConflictDoUpdate({
      target: schema.userAccess.userId,
      set: {
        firstSeenAt: sql`coalesce(${schema.userAccess.firstSeenAt}, now())`,
        lastSeenAt: sql`now()`,
      },
    });
}

/** Per-request access lookup (hooks). Also records first/last seen, throttled. */
export async function loadZapAccess(userId: string, opts: { touch?: boolean } = {}): Promise<ZapAccess> {
  const [row, mode] = await Promise.all([db.query.userAccess.findFirst({ where: eq(schema.userAccess.userId, userId) }), getPortalAccessMode()]);
  if (opts.touch && shouldTouchLastSeen(row?.lastSeenAt)) {
    void touchLastSeen(userId).catch((err) => console.warn("[zap access] last-seen update failed", err));
  }
  const isAdmin = row?.isAdmin ?? false;
  const status = row?.status ?? "default";
  return { isAdmin, status, mode, access: resolvePortalAccess({ isAdmin, status, mode }) };
}

/** Server-side gate for every privileged Zap action. 401 without a session, 403 for non-admins. */
export function requireZapAdmin(locals: App.Locals) {
  if (!locals.user) throw error(401, "Sign in required");
  if (!locals.user.emailVerified || !locals.zapAccess?.isAdmin) throw error(403, "Zap admin access required");
  return locals.user;
}

export type ZapUserRow = {
  userId: string;
  email: string;
  username: string | null;
  isAdmin: boolean;
  status: UserAccessStatus;
  access: PortalAccess;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
};

/** Accounts known to Zap (visited or edited by an admin), most recently seen first. */
export async function listZapUsers(mode: PortalAccessMode, limit = 500): Promise<ZapUserRow[]> {
  const rows = await db
    .select({ access: schema.userAccess, user: { id: schema.user.id, email: schema.user.email, username: schema.user.username } })
    .from(schema.userAccess)
    .innerJoin(schema.user, eq(schema.user.id, schema.userAccess.userId))
    .orderBy(sql`${schema.userAccess.lastSeenAt} desc nulls last`, desc(schema.userAccess.createdAt))
    .limit(limit);
  return rows.map(({ access, user }) => ({
    userId: user.id,
    email: user.email,
    username: user.username,
    isAdmin: access.isAdmin,
    status: access.status,
    access: resolvePortalAccess({ isAdmin: access.isAdmin, status: access.status, mode }),
    firstSeenAt: access.firstSeenAt?.toISOString() ?? null,
    lastSeenAt: access.lastSeenAt?.toISOString() ?? null,
  }));
}

/** Exact (case-insensitive) email or username match across Pocket Dimension accounts. */
export async function findAccountByLogin(login: string) {
  const value = login.trim();
  if (!value) return null;
  return (
    (await db.query.user.findFirst({
      where: or(ilike(schema.user.email, value), ilike(schema.user.username, value)),
      columns: { id: true, email: true, username: true },
    })) ?? null
  );
}

async function getTargetAccess(targetUserId: string) {
  const account = await db.query.user.findFirst({ where: eq(schema.user.id, targetUserId), columns: { id: true } });
  if (!account) throw new AccessChangeError("Account not found", 404);
  return db.query.userAccess.findFirst({ where: eq(schema.userAccess.userId, targetUserId) });
}

export async function setUserAccessStatus(actorUserId: string, targetUserId: string, status: UserAccessStatus) {
  const existing = await getTargetAccess(targetUserId);
  const problem = validateAccessChange({
    actorUserId,
    targetUserId,
    targetIsAdmin: existing?.isAdmin ?? false,
    change: { kind: "status", status },
  });
  if (problem) throw new AccessChangeError(problem);

  await db
    .insert(schema.userAccess)
    .values({ userId: targetUserId, status, updatedByUserId: actorUserId })
    .onConflictDoUpdate({
      target: schema.userAccess.userId,
      set: { status, updatedByUserId: actorUserId, updatedAt: sql`now()` },
    });

  if (status === "blocked") {
    return removeUserFromLiveSessions(targetUserId);
  }
  return null;
}

export async function setUserAdmin(actorUserId: string, targetUserId: string, isAdmin: boolean) {
  const existing = await getTargetAccess(targetUserId);
  const problem = validateAccessChange({
    actorUserId,
    targetUserId,
    targetIsAdmin: existing?.isAdmin ?? false,
    change: { kind: "admin", isAdmin },
  });
  if (problem) throw new AccessChangeError(problem);

  // Promoting clears a stale block so revoking admin later doesn't silently re-block.
  const status: UserAccessStatus | undefined = isAdmin && existing?.status === "blocked" ? "default" : undefined;
  await db
    .insert(schema.userAccess)
    .values({ userId: targetUserId, isAdmin, status: status ?? "default", updatedByUserId: actorUserId })
    .onConflictDoUpdate({
      target: schema.userAccess.userId,
      set: { isAdmin, ...(status ? { status } : {}), updatedByUserId: actorUserId, updatedAt: sql`now()` },
    });
}
