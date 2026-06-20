export type LeaderboardMetric = "watched" | "watching" | "watch_later" | "dropped" | "all_rated";

export type LeaderboardFilters = {
  languages: string[];
  types: string[];
  tags: string[];
};

export type LeaderboardEntry = {
  rank: number;
  userId: string;
  username: string;
  displayUsername: string | null;
  name: string;
  count: number;
};

export type LeaderboardData = {
  metric: LeaderboardMetric;
  filters: LeaderboardFilters;
  entries: LeaderboardEntry[];
  filterOptions: {
    languages: string[];
    types: string[];
    tags: string[];
  };
};

export const METRIC_LABELS: Record<LeaderboardMetric, string> = {
  watched: "Watched",
  watching: "Watching",
  watch_later: "Watch Later",
  dropped: "Dropped",
  all_rated: "All Rated",
};

export const LEADERBOARD_METRICS: LeaderboardMetric[] = ["watched", "watching", "watch_later", "dropped", "all_rated"];

const VALID_METRICS = new Set<LeaderboardMetric>(LEADERBOARD_METRICS);

function parseMetric(value: string | null): LeaderboardMetric {
  if (value && VALID_METRICS.has(value as LeaderboardMetric)) {
    return value as LeaderboardMetric;
  }
  return "watched";
}

function parseCsvParam(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

export function parseLeaderboardParams(url: URL): { metric: LeaderboardMetric; filters: LeaderboardFilters } {
  return {
    metric: parseMetric(url.searchParams.get("metric")),
    filters: {
      languages: parseCsvParam(url.searchParams.get("filterLanguage")),
      types: parseCsvParam(url.searchParams.get("filterType")),
      tags: parseCsvParam(url.searchParams.get("filterTags")),
    },
  };
}
