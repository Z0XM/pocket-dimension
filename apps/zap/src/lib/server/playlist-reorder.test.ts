import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { db, schema } from "@pocket-dimension/db";
import { eq, inArray } from "drizzle-orm";
import { createPlaylist, getPlaylistDetail, reorderPlaylistTracks, sortPlaylistTracksPersisted } from "./playlists";

/** Hits the real database (zap schema must be migrated); skipped when DATABASE_URL is unset. */
describe.skipIf(!process.env.DATABASE_URL)("playlist reorder / sort", () => {
  const run = crypto.randomUUID().slice(0, 8);
  let userId = "";
  let otherUserId = "";
  const assetIds: string[] = [];
  let playlistId = "";

  async function insertAsset(title: string, artists: string | null = null) {
    const [row] = await db
      .insert(schema.mediaAssets)
      .values({
        identityKey: `test:reorder:${run}:${title}`,
        sourceType: "upload",
        status: "ready",
        storageKey: `test/${run}/${title}`,
        title,
        artists,
      })
      .returning();
    assetIds.push(row!.id);
    return row!.id;
  }

  beforeAll(async () => {
    const now = new Date();
    const [user] = await db
      .insert(schema.user)
      .values({ name: "Reorder Test", email: `reorder-test-${run}@example.test`, emailVerified: true, createdAt: now, updatedAt: now })
      .returning();
    userId = user!.id;
    const [other] = await db
      .insert(schema.user)
      .values({ name: "Other", email: `reorder-other-${run}@example.test`, emailVerified: true, createdAt: now, updatedAt: now })
      .returning();
    otherUserId = other!.id;

    const a = await insertAsset("Zebra", "Beta");
    const b = await insertAsset("Apple", null);
    const c = await insertAsset("Mango", "Alpha");
    const created = await createPlaylist({ userId, name: `Reorder ${run}`, mediaAssetIds: [a, b, c] });
    playlistId = created.id;
  });

  afterAll(async () => {
    if (playlistId) {
      await db.delete(schema.playlistItems).where(eq(schema.playlistItems.playlistId, playlistId));
      await db.delete(schema.playlistMembers).where(eq(schema.playlistMembers.playlistId, playlistId));
      await db.delete(schema.playlists).where(eq(schema.playlists.id, playlistId));
    }
    if (assetIds.length) await db.delete(schema.mediaAssets).where(inArray(schema.mediaAssets.id, assetIds));
    if (userId) await db.delete(schema.user).where(eq(schema.user.id, userId));
    if (otherUserId) await db.delete(schema.user).where(eq(schema.user.id, otherUserId));
  });

  test("reorder persists a new permutation of item ids", async () => {
    const before = await getPlaylistDetail(playlistId, userId);
    expect(before.items.map((i) => i.title)).toEqual(["Zebra", "Apple", "Mango"]);
    const flipped = [...before.items.map((i) => i.id)].reverse();
    const after = await reorderPlaylistTracks(playlistId, userId, flipped);
    expect(after.items.map((i) => i.id)).toEqual(flipped);
    expect(after.items.map((i) => i.position)).toEqual([0, 1, 2]);
  });

  test("reorder rejects non-editors", async () => {
    const detail = await getPlaylistDetail(playlistId, userId);
    await expect(reorderPlaylistTracks(playlistId, otherUserId, detail.items.map((i) => i.id))).rejects.toMatchObject({
      status: 403,
    });
  });

  test("reorder rejects non-permutations", async () => {
    const detail = await getPlaylistDetail(playlistId, userId);
    await expect(reorderPlaylistTracks(playlistId, userId, [detail.items[0]!.id])).rejects.toMatchObject({ status: 409 });
  });

  test("sort by title persists order", async () => {
    const after = await sortPlaylistTracksPersisted(playlistId, userId, "title_asc");
    expect(after.items.map((i) => i.title)).toEqual(["Apple", "Mango", "Zebra"]);
    expect(after.items.map((i) => i.position)).toEqual([0, 1, 2]);
  });

  test("sort by artist puts missing artists last", async () => {
    const after = await sortPlaylistTracksPersisted(playlistId, userId, "artist_asc");
    expect(after.items.map((i) => i.title)).toEqual(["Mango", "Zebra", "Apple"]);
  });
});
