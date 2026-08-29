/** Levels controllable via `pages.testLevels` (L5 = UI expectations, not Vitest). */
export const CONFIG_TEST_LEVELS = ["L1", "L2", "L3", "L4", "tooling", "L5"] as const;
export type ConfigTestLevel = (typeof CONFIG_TEST_LEVELS)[number];

export const DEFAULT_TEST_LEVELS: readonly ConfigTestLevel[] = CONFIG_TEST_LEVELS;

/** Resolve enabled levels: omit/undefined → all; explicit list → that set (empty → none). */
export function resolveEnabledTestLevels(configured: readonly ConfigTestLevel[] | undefined | null): Set<ConfigTestLevel> {
  if (configured == null) return new Set(DEFAULT_TEST_LEVELS);
  return new Set(configured);
}

export function isConfigTestLevelEnabled(level: string, enabled: ReadonlySet<ConfigTestLevel>): boolean {
  return enabled.has(level as ConfigTestLevel);
}
