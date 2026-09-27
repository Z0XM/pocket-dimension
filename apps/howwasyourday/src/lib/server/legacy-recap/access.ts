import { db, schema } from "@pocket-dimension/db";
import { and, asc, eq } from "drizzle-orm";
import { CLAIM_COOKIE_NAME, verifyClaimToken } from "./claim-cookie";

const YEAR = 2025;

export type PublicProfile = {
  id: string;
  slug: string;
  displayName: string;
  accentColor: string;
  rank: number;
  daysFilled: number;
  drawingsCount: number;
  monthsFilled: number;
  avgScore: string | null;
  firstDate: string | null;
  lastDate: string | null;
};

export async function getPublicProfiles(): Promise<PublicProfile[]> {
  const rows = await db
    .select({
      id: schema.legacyRecapProfile.id,
      slug: schema.legacyRecapProfile.slug,
      displayName: schema.legacyRecapProfile.displayName,
      accentColor: schema.legacyRecapProfile.accentColor,
      rank: schema.legacyRecapProfile.rank,
      daysFilled: schema.legacyRecapProfile.daysFilled,
      drawingsCount: schema.legacyRecapProfile.drawingsCount,
      monthsFilled: schema.legacyRecapProfile.monthsFilled,
      avgScore: schema.legacyRecapProfile.avgScore,
      firstDate: schema.legacyRecapProfile.firstDate,
      lastDate: schema.legacyRecapProfile.lastDate,
    })
    .from(schema.legacyRecapProfile)
    .where(eq(schema.legacyRecapProfile.year, YEAR))
    .orderBy(asc(schema.legacyRecapProfile.rank));

  return rows;
}

export async function getProfileBySlug(slug: string) {
  const rows = await db
    .select()
    .from(schema.legacyRecapProfile)
    .where(and(eq(schema.legacyRecapProfile.slug, slug), eq(schema.legacyRecapProfile.year, YEAR)))
    .limit(1);
  return rows[0] ?? null;
}

export async function getProfilePublicBySlug(slug: string): Promise<PublicProfile | null> {
  const rows = await db
    .select({
      id: schema.legacyRecapProfile.id,
      slug: schema.legacyRecapProfile.slug,
      displayName: schema.legacyRecapProfile.displayName,
      accentColor: schema.legacyRecapProfile.accentColor,
      rank: schema.legacyRecapProfile.rank,
      daysFilled: schema.legacyRecapProfile.daysFilled,
      drawingsCount: schema.legacyRecapProfile.drawingsCount,
      monthsFilled: schema.legacyRecapProfile.monthsFilled,
      avgScore: schema.legacyRecapProfile.avgScore,
      firstDate: schema.legacyRecapProfile.firstDate,
      lastDate: schema.legacyRecapProfile.lastDate,
    })
    .from(schema.legacyRecapProfile)
    .where(and(eq(schema.legacyRecapProfile.slug, slug), eq(schema.legacyRecapProfile.year, YEAR)))
    .limit(1);
  return rows[0] ?? null;
}

export async function userHasLink(userId: string, profileId: string): Promise<boolean> {
  const rows = await db
    .select({ id: schema.legacyRecapLink.id })
    .from(schema.legacyRecapLink)
    .where(and(eq(schema.legacyRecapLink.userId, userId), eq(schema.legacyRecapLink.profileId, profileId)))
    .limit(1);
  return rows.length > 0;
}

export async function upsertLink(userId: string, profileId: string): Promise<void> {
  const now = new Date();
  await db
    .insert(schema.legacyRecapLink)
    .values({
      profileId,
      userId,
      linkedAt: now,
    })
    .onConflictDoUpdate({
      target: schema.legacyRecapLink.profileId,
      set: {
        userId,
        linkedAt: now,
      },
    });
}

/** Authz: claim cookie for slug OR linked Pocket Dimension account. */
export async function canAccessProfile(opts: {
  slug: string;
  profileId: string;
  cookies: { get: (name: string) => string | undefined };
  userId?: string | null;
}): Promise<boolean> {
  const claim = verifyClaimToken(opts.cookies.get(CLAIM_COOKIE_NAME), opts.slug);
  if (claim && claim.profileId === opts.profileId) return true;
  if (opts.userId && (await userHasLink(opts.userId, opts.profileId))) return true;
  return false;
}

export async function canAccessDrawing(opts: {
  drawingId: string;
  cookies: { get: (name: string) => string | undefined };
  userId?: string | null;
}): Promise<{ ok: true; png: Buffer; contentType: string } | { ok: false }> {
  const rows = await db
    .select({
      id: schema.legacyRecapDrawing.id,
      png: schema.legacyRecapDrawing.png,
      contentType: schema.legacyRecapDrawing.contentType,
      profileId: schema.legacyRecapDrawing.profileId,
      slug: schema.legacyRecapProfile.slug,
    })
    .from(schema.legacyRecapDrawing)
    .innerJoin(schema.legacyRecapProfile, eq(schema.legacyRecapDrawing.profileId, schema.legacyRecapProfile.id))
    .where(eq(schema.legacyRecapDrawing.id, opts.drawingId))
    .limit(1);

  const row = rows[0];
  if (!row) return { ok: false };

  const allowed = await canAccessProfile({
    slug: row.slug,
    profileId: row.profileId,
    cookies: opts.cookies,
    userId: opts.userId,
  });
  if (!allowed) return { ok: false };

  return { ok: true, png: row.png as Buffer, contentType: row.contentType };
}
