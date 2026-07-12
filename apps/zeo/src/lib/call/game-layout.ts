import type { StageTileEntry } from "$lib/call/stage-tiles";
import { computeParticipantGrid, tilePosition, type StageGridLayout, type TilePosition } from "$lib/stage-grid";
import type { GameSnapshotTeam } from "$lib/server/game/types";

const TEAM_GUTTER_PX = 8;

/** Placeholder game layout: equal-width team columns until Epic 11. */
export function computeGameLayoutFrames(
  tiles: StageTileEntry[],
  gridLayout: StageGridLayout,
  teams: GameSnapshotTeam[]
): Map<string, TilePosition> | null {
  if (!gridLayout || teams.length === 0 || tiles.length === 0) return null;

  const sortedTeams = teams.slice().sort((a, b) => a.sortOrder - b.sortOrder);
  const gutter = TEAM_GUTTER_PX;
  const columnWidth = (gridLayout.width - gutter * (sortedTeams.length - 1)) / sortedTeams.length;
  const frames = new Map<string, TilePosition>();

  sortedTeams.forEach((team, teamIndex) => {
    const memberSet = new Set(team.memberUserIds);
    const teamTiles = tiles.filter((tile) => memberSet.has(tile.participant.identity));
    if (teamTiles.length === 0) return;

    const columnLayout: StageGridLayout = {
      cols: gridLayout.cols,
      rows: gridLayout.rows,
      cellSize: gridLayout.cellSize,
      offsetX: gridLayout.offsetX + teamIndex * (columnWidth + gutter),
      offsetY: gridLayout.offsetY,
      width: columnWidth,
      height: gridLayout.height,
    };

    const participantGrid = computeParticipantGrid(teamTiles.length, columnLayout);
    if (!participantGrid) return;

    teamTiles.forEach((tile, index) => {
      frames.set(tile.key, tilePosition(participantGrid, index));
    });
  });

  const assigned = new Set(frames.keys());
  const unassigned = tiles.filter((tile) => !assigned.has(tile.key));
  if (unassigned.length > 0) {
    const fallbackGrid = computeParticipantGrid(unassigned.length, gridLayout);
    if (fallbackGrid) {
      unassigned.forEach((tile, index) => {
        frames.set(tile.key, tilePosition(fallbackGrid, index));
      });
    }
  }

  return frames.size > 0 ? frames : null;
}
