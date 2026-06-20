import { parseLeaderboardParams } from "$lib/leaderboard";
import { getLeaderboardData } from "$lib/server/leaderboard";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ url }) => {
  const { metric, filters } = parseLeaderboardParams(url);

  try {
    const leaderboard = await getLeaderboardData(metric, filters);
    return { leaderboard };
  } catch (error) {
    console.error("Error loading leaderboard:", error);
    return { leaderboard: null };
  }
};
