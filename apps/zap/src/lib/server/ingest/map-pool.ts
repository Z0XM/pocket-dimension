/** Run async work over `items` with at most `concurrency` in flight. Preserves result order. */
export async function mapPool<T, R>(items: readonly T[], concurrency: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  if (items.length === 0) return [];
  const limit = Math.max(1, Math.min(concurrency, items.length));
  const results = new Array<R>(items.length);
  let next = 0;

  async function worker() {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await fn(items[index]!, index);
    }
  }

  await Promise.all(Array.from({ length: limit }, () => worker()));
  return results;
}

export function youtubeIngestConcurrency() {
  const raw = Number(Bun.env.ZAP_YT_INGEST_CONCURRENCY ?? Bun.env.ZAP_INGEST_CONCURRENCY ?? 4);
  if (!Number.isFinite(raw)) return 4;
  return Math.max(1, Math.min(8, Math.floor(raw)));
}
