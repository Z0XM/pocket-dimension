import { describe, expect, test } from "bun:test";

/** Mirrors contiguous block allocation used by setUserLibraryOrder. */
function allocateSortKeys(maxExisting: number, count: number) {
  const base = maxExisting + 1000;
  return Array.from({ length: count }, (_, i) => base + i);
}

describe("library order keys", () => {
  test("allocates contiguous keys after max", () => {
    expect(allocateSortKeys(0, 3)).toEqual([1000, 1001, 1002]);
    expect(allocateSortKeys(42, 2)).toEqual([1042, 1043]);
  });
});
