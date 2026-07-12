import type { StageTileEntry } from "$lib/call/stage-tiles";
import { computeAutoLayoutFrames, type AutoLayoutOptions, type AutoLayoutPreset } from "$lib/call/auto-layout";
import { computeStageGrid, type StageGridLayout, type TilePosition } from "$lib/stage-grid";
import type { GameSnapshotTeam } from "$lib/server/game/types";

const TEAM_GUTTER_PX = 10;

function columnStage(width: number, height: number, cellSizeHint: number): StageGridLayout {
  const stage = computeStageGrid(width, height, { minCellSize: Math.max(48, cellSizeHint * 0.75) });
  if (!stage) {
    return {
      cols: 1,
      rows: 1,
      cellSize: Math.min(width, height),
      offsetX: 0,
      offsetY: 0,
      width,
      height,
    };
  }
  return stage;
}

function teamColumnLayout(gridLayout: StageGridLayout, teamIndex: number, teamCount: number) {
  const gutter = TEAM_GUTTER_PX;
  const columnWidth = (gridLayout.width - gutter * (teamCount - 1)) / teamCount;
  const columnLeft = gridLayout.offsetX + teamIndex * (columnWidth + gutter);

  return {
    columnLeft,
    columnTop: gridLayout.offsetY,
    stage: columnStage(columnWidth, gridLayout.height, gridLayout.cellSize),
  };
}

/** Team-separated columns; each column uses the same auto-layout algorithm as call auto mode. */
export function computeGameLayoutFrames(
  tiles: StageTileEntry[],
  gridLayout: StageGridLayout,
  teams: GameSnapshotTeam[],
  autoLayoutPreset: AutoLayoutPreset,
  activeSpeakerIdentity: string | null,
  options: AutoLayoutOptions = {}
): Map<string, TilePosition> | null {
  if (!gridLayout || teams.length === 0 || tiles.length === 0) return null;

  const sortedTeams = teams.slice().sort((a, b) => a.sortOrder - b.sortOrder);
  const frames = new Map<string, TilePosition>();

  sortedTeams.forEach((team, teamIndex) => {
    const memberSet = new Set(team.memberUserIds);
    const teamTiles = tiles.filter((tile) => memberSet.has(tile.participant.identity));
    if (teamTiles.length === 0) return;

    const { columnLeft, columnTop, stage } = teamColumnLayout(gridLayout, teamIndex, sortedTeams.length);
    const localFrames = computeAutoLayoutFrames(teamTiles, stage, autoLayoutPreset, activeSpeakerIdentity, options);

    for (const [key, position] of Object.entries(localFrames)) {
      frames.set(key, {
        left: columnLeft + position.left,
        top: columnTop + position.top,
        width: position.width,
        height: position.height,
      });
    }
  });

  const assigned = new Set(frames.keys());
  const unassigned = tiles.filter((tile) => !assigned.has(tile.key));
  if (unassigned.length > 0) {
    const fallback = computeAutoLayoutFrames(unassigned, gridLayout, autoLayoutPreset, activeSpeakerIdentity, options);
    for (const [key, position] of Object.entries(fallback)) {
      frames.set(key, position);
    }
  }

  return frames.size > 0 ? frames : null;
}

export function teamColorByUserId(teams: GameSnapshotTeam[]) {
  const map = new Map<string, string>();
  for (const team of teams) {
    for (const userId of team.memberUserIds) {
      map.set(userId, team.colorKey);
    }
  }
  return map;
}
