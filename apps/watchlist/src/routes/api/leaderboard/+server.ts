import { getLeaderboardData, parseLeaderboardParams } from "$lib/server/leaderboard";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ url }) => {
  const { metric, filters } = parseLeaderboardParams(url);
  const data = await getLeaderboardData(metric, filters);
  return json(data);
};
