/** Simple insertion-order LRU for yt-dlp audio URLs (strings only — not media bytes). */
export function createLruStringCache(maxEntries: number) {
  const map = new Map<string, string>();

  return {
    get(key: string) {
      const value = map.get(key);
      if (value === undefined) return undefined;
      // Refresh recency.
      map.delete(key);
      map.set(key, value);
      return value;
    },
    set(key: string, value: string) {
      if (map.has(key)) map.delete(key);
      map.set(key, value);
      while (map.size > maxEntries) {
        const oldest = map.keys().next().value;
        if (oldest === undefined) break;
        map.delete(oldest);
      }
    },
    delete(key: string) {
      map.delete(key);
    },
    clear() {
      map.clear();
    },
    get size() {
      return map.size;
    },
  };
}

export type LruStringCache = ReturnType<typeof createLruStringCache>;
