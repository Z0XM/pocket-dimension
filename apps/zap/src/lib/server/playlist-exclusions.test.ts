import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { db, schema } from "@pocket-dimension/db";
import { eq, inArray } from "drizzle-orm";
import { addPlaylistTrack, createPlaylist, getPlaylistDetail, setPlaylistExclusion, setPlaylistTagQuery } from "./playlists";

/** Hits the real database (zap schema must be migrated); skipped when DATABASE_URL is unset. */
describe.skipIf(!process.env.DATABASE_URL)("playlist exclude / restore", () => {
  const run = crypto.randomUUID().slice(0, 8);
  const tagSlug = `restore-test-${run}`;
  let userId = "";
  const assetIds: string[] = [];

  async function insertAsset(title: string) {
    const [row] = await db
      .insert(schema.mediaAssets)
      .values({
        identityKey: `test:restore:${run}:${title}`,
        sourceType: "upload",
        status: "ready",
        storageKey: `test/${run}/${title}`,
        title,
      })
      .returning();
    assetIds.push(row!.id);
    return row!.id;
  }

  const itemIds = async (playlistId: string) => (await getPlaylistDetail(playlistId, userId)).items.map((i) => i.mediaAssetId);
  const exclusionIds = async (playlistId: string) => (await getPlaylistDetail(playlistId, userId)).exclusions.map((e) => e.mediaAssetId);

  beforeAll(async () => {
    const now = new Date();
    const [user] = await db
      .insert(schema.user)
      .values({ name: "Restore Test", email: `restore-test-${run}@example.test`, emailVerified: true, createdAt: now, updatedAt: now })
      .returning();
    userId = user!.id;
  });

  afterAll(async () => {
    if (userId) await db.delete(schema.user).where(eq(schema.user.id, userId));
    if (assetIds.length) await db.delete(schema.mediaAssets).where(inArray(schema.mediaAssets.id, assetIds));
  });

  test("restoring a track in a hand-picked playlist puts it back", async () => {
    const a = await insertAsset("Alpha");
    const b = await insertAsset("Bravo");
    const playlist = await createPlaylist({ userId, name: "Freehand" });
    await addPlaylistTrack(playlist.id, userId, a);
    await addPlaylistTrack(playlist.id, userId, b);

    await setPlaylistExclusion(playlist.id, userId, a, true);
    expect(await itemIds(playlist.id)).toEqual([b]);
    expect(await exclusionIds(playlist.id)).toEqual([a]);

    const restored = await setPlaylistExclusion(playlist.id, userId, a, false);
    expect(restored.items.map((i) => i.mediaAssetId)).toEqual([b, a]);
    expect(restored.items.map((i) => i.position)).toEqual([0, 1]);
    expect(restored.exclusions).toEqual([]);
    expect(restored.trackCount).toBe(2);
  });

  test("restoring a track in a tag-query playlist re-includes it now and after rebuild", async () => {
    const c = await insertAsset("Charlie");
    const d = await insertAsset("Delta");
    const [tag] = await db.insert(schema.tags).values({ name: tagSlug, slug: tagSlug, kind: "custom", ownerUserId: userId }).returning();
    await db.insert(schema.mediaAssetTags).values([
      { userId, mediaAssetId: c, tagId: tag!.id },
      { userId, mediaAssetId: d, tagId: tag!.id },
    ]);

    const playlist = await createPlaylist({ userId, name: "Tagged", tagQuery: tagSlug });
    expect(await itemIds(playlist.id)).toEqual([c, d]);

    await setPlaylistExclusion(playlist.id, userId, c, true);
    await setPlaylistTagQuery(playlist.id, userId, tagSlug);
    expect(await itemIds(playlist.id)).toEqual([d]);

    const restored = await setPlaylistExclusion(playlist.id, userId, c, false);
    expect(restored.items.map((i) => i.mediaAssetId)).toContain(c);
    expect(restored.exclusions).toEqual([]);

    await setPlaylistTagQuery(playlist.id, userId, tagSlug);
    expect(await itemIds(playlist.id)).toEqual([c, d]);
  });

  test("restoring a track that is already present does not duplicate it", async () => {
    const e = await insertAsset("Echo");
    const playlist = await createPlaylist({ userId, name: "No dupes" });
    await addPlaylistTrack(playlist.id, userId, e);

    const restored = await setPlaylistExclusion(playlist.id, userId, e, false);
    expect(restored.items.map((i) => i.mediaAssetId)).toEqual([e]);
  });
});
