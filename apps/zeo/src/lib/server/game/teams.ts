const TEAM_COLOR_KEYS = ["#16a34a", "#2563eb", "#dc2626", "#ca8a04", "#7c3aed", "#c2410c"] as const;

function fisherYates<T>(items: T[]) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

export function teamNameForIndex(index: number) {
  return `Team ${String.fromCharCode(65 + index)}`;
}

export function teamColorKeyForIndex(index: number) {
  return TEAM_COLOR_KEYS[index % TEAM_COLOR_KEYS.length];
}

/** Evenly distribute user ids across teams (round-robin after shuffle). */
export function autoSplitTeams(userIds: string[], teamCount: number): string[][] {
  if (teamCount < 1) {
    throw new Error("teamCount must be at least 1");
  }

  const shuffled = fisherYates(userIds);
  const buckets = Array.from({ length: teamCount }, () => [] as string[]);
  shuffled.forEach((userId, index) => {
    buckets[index % teamCount].push(userId);
  });

  return buckets;
}
