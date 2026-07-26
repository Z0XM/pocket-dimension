import type { StageTileEntry } from "$lib/call/stage-tiles";
import { TILE_ASPECT_RATIO, type StageGridLayout, type TilePosition } from "$lib/stage-grid";

export type AutoLayoutPreset = "gallery" | "speaker" | "sidebar";

export const AUTO_LAYOUT_PRESETS: Array<{
  id: AutoLayoutPreset;
  label: string;
}> = [
  { id: "gallery", label: "Gallery" },
  { id: "speaker", label: "Speaker" },
  { id: "sidebar", label: "Sidebar" },
];

const AUTO_LAYOUT_PRESET_IDS = new Set<AutoLayoutPreset>(AUTO_LAYOUT_PRESETS.map((preset) => preset.id));

export function isAutoLayoutPreset(value: string | null): value is AutoLayoutPreset {
  return value !== null && AUTO_LAYOUT_PRESET_IDS.has(value as AutoLayoutPreset);
}

/** Migrate removed presets (e.g. legacy "dynamic") to a supported default. */
export function normalizeAutoLayoutPreset(value: string | null): AutoLayoutPreset {
  if (isAutoLayoutPreset(value)) return value;
  return "gallery";
}

function stageArea(stage: StageGridLayout) {
  return {
    left: 0,
    top: 0,
    width: stage.offsetX * 2 + stage.width,
    height: stage.offsetY * 2 + stage.height,
  };
}

function findDefaultPrimaryIndex(tiles: StageTileEntry[], activeSpeakerIdentity: string | null) {
  const screenShareIndex = tiles.findIndex((tile) => tile.kind === "screen-share");
  if (screenShareIndex >= 0) return screenShareIndex;

  const listeningIndex = tiles.findIndex((tile) => tile.kind === "listening");
  if (listeningIndex >= 0) return listeningIndex;

  if (activeSpeakerIdentity) {
    const activeSpeakerIndex = tiles.findIndex((tile) => tile.kind === "participant" && tile.participant.identity === activeSpeakerIdentity);
    if (activeSpeakerIndex >= 0) return activeSpeakerIndex;
  }

  return 0;
}

/** Pinned tiles fill the main stage; otherwise one default primary (speaker / share). */
export function resolveMainAndOtherTiles(
  tiles: StageTileEntry[],
  activeSpeakerIdentity: string | null,
  pinnedTileKeys: string[]
): { main: StageTileEntry[]; others: StageTileEntry[] } {
  if (tiles.length === 0) return { main: [], others: [] };

  const tileByKey = new Map(tiles.map((tile) => [tile.key, tile]));
  const main = pinnedTileKeys.map((key) => tileByKey.get(key)).filter((tile): tile is StageTileEntry => Boolean(tile));

  if (main.length > 0) {
    const mainKeys = new Set(main.map((tile) => tile.key));
    return {
      main,
      others: tiles.filter((tile) => !mainKeys.has(tile.key)),
    };
  }

  const primaryIndex = findDefaultPrimaryIndex(tiles, activeSpeakerIdentity);
  return {
    main: [tiles[primaryIndex]],
    others: tiles.filter((_, index) => index !== primaryIndex),
  };
}

function layoutEqualRegion(
  tiles: StageTileEntry[],
  left: number,
  top: number,
  width: number,
  height: number,
  gap: number
): Record<string, TilePosition> {
  if (tiles.length === 0 || width <= 0 || height <= 0) return {};

  const { cols, rows } = chooseGalleryGridDims(tiles.length, width, height);
  if (cols < 1 || rows < 1) return {};

  const tileWidth = (width - gap * (cols - 1)) / cols;
  const tileHeight = (height - gap * (rows - 1)) / rows;
  const frames: Record<string, TilePosition> = {};

  for (const [index, tile] of tiles.entries()) {
    const col = index % cols;
    const row = Math.floor(index / cols);
    frames[tile.key] = {
      left: left + col * (tileWidth + gap),
      top: top + row * (tileHeight + gap),
      width: tileWidth,
      height: tileHeight,
    };
  }

  return frames;
}

/**
 * Pick cols/rows that divide the stage into equal cells.
 * Matches grid shape to the stage (landscape → more columns) and allows a
 * few empty slots so 4→2×2 and 5→2×3 instead of tall 1×N stacks.
 */
export function chooseGalleryGridDims(count: number, stageWidth: number, stageHeight: number) {
  if (count <= 0) return { cols: 0, rows: 0 };
  if (count === 1) return { cols: 1, rows: 1 };

  const stageAspect = stageWidth / Math.max(1, stageHeight);
  let bestCols = 1;
  let bestRows = count;
  let bestScore = Infinity;

  for (let cols = 1; cols <= count; cols++) {
    const rows = Math.ceil(count / cols);
    const cellWidth = stageWidth / cols;
    const cellHeight = stageHeight / rows;
    if (cellWidth <= 0 || cellHeight <= 0) continue;

    const cellAspect = cellWidth / cellHeight;
    const gridAspect = cols / rows;
    const cellAspectDiff = Math.abs(Math.log(cellAspect / TILE_ASPECT_RATIO));
    const stageShapeDiff = Math.abs(Math.log(gridAspect / stageAspect));
    const empty = cols * rows - count;
    const score = stageShapeDiff * 2.2 + cellAspectDiff * 0.8 + empty * 0.45;

    if (score < bestScore) {
      bestScore = score;
      bestCols = cols;
      bestRows = rows;
    }
  }

  return { cols: bestCols, rows: bestRows };
}

/** Equal grid: divide the stage into a balanced cols×rows layout. */
function layoutGallery(tiles: StageTileEntry[], stage: StageGridLayout) {
  const count = tiles.length;
  if (count === 0) return {} as Record<string, TilePosition>;

  const area = stageArea(stage);
  const padding = 8;
  const gap = 8;
  const innerWidth = Math.max(0, area.width - padding * 2);
  const innerHeight = Math.max(0, area.height - padding * 2);
  const { cols, rows } = chooseGalleryGridDims(count, innerWidth, innerHeight);
  if (cols < 1 || rows < 1) return {} as Record<string, TilePosition>;

  const tileWidth = (innerWidth - gap * (cols - 1)) / cols;
  const tileHeight = (innerHeight - gap * (rows - 1)) / rows;
  const frames: Record<string, TilePosition> = {};

  for (const [index, tile] of tiles.entries()) {
    const col = index % cols;
    const row = Math.floor(index / cols);
    frames[tile.key] = {
      left: area.left + padding + col * (tileWidth + gap),
      top: area.top + padding + row * (tileHeight + gap),
      width: tileWidth,
      height: tileHeight,
    };
  }

  return frames;
}

function layoutSpeaker(
  tiles: StageTileEntry[],
  stage: StageGridLayout,
  activeSpeakerIdentity: string | null,
  pinnedTileKeys: string[],
  mainRatio: number
) {
  const area = stageArea(stage);
  const padding = 8;
  const gap = 6;

  if (tiles.length === 1) {
    return {
      [tiles[0].key]: {
        left: area.left + padding,
        top: area.top + padding,
        width: area.width - padding * 2,
        height: area.height - padding * 2,
      },
    };
  }

  const { main, others } = resolveMainAndOtherTiles(tiles, activeSpeakerIdentity, pinnedTileKeys);
  const frames: Record<string, TilePosition> = {};

  if (others.length === 0) {
    return layoutEqualRegion(main, area.left + padding, area.top + padding, area.width - padding * 2, area.height - padding * 2, gap);
  }

  const ratio = Math.min(0.85, Math.max(0.55, mainRatio));
  const availableHeight = Math.max(0, area.height - padding * 2 - gap);
  let mainHeight = availableHeight * ratio;
  let stripHeight = availableHeight - mainHeight;
  const minStrip = 64;
  if (stripHeight < minStrip && availableHeight > minStrip) {
    stripHeight = minStrip;
    mainHeight = availableHeight - stripHeight;
  }

  const stripTop = area.top + padding;
  const mainTop = stripTop + stripHeight + gap;
  const mainLeft = area.left + padding;
  const mainWidth = area.width - padding * 2;

  Object.assign(frames, layoutEqualRegion(main, mainLeft, mainTop, mainWidth, mainHeight, gap));

  const thumbWidth = (area.width - padding * 2 - gap * (others.length - 1)) / others.length;
  for (const [index, tile] of others.entries()) {
    frames[tile.key] = {
      left: area.left + padding + index * (thumbWidth + gap),
      top: stripTop,
      width: thumbWidth,
      height: stripHeight,
    };
  }

  return frames;
}

function layoutSidebar(
  tiles: StageTileEntry[],
  stage: StageGridLayout,
  activeSpeakerIdentity: string | null,
  pinnedTileKeys: string[],
  splitRatio: number
) {
  const area = stageArea(stage);
  const padding = 8;
  const gap = 8;

  if (tiles.length === 1) {
    return {
      [tiles[0].key]: {
        left: area.left + padding,
        top: area.top + padding,
        width: area.width - padding * 2,
        height: area.height - padding * 2,
      },
    };
  }

  const { main, others } = resolveMainAndOtherTiles(tiles, activeSpeakerIdentity, pinnedTileKeys);
  const frames: Record<string, TilePosition> = {};

  if (others.length === 0) {
    return layoutEqualRegion(main, area.left + padding, area.top + padding, area.width - padding * 2, area.height - padding * 2, gap);
  }

  const ratio = Math.min(0.85, Math.max(0.55, splitRatio));
  const sidebarWidth = Math.min(Math.max(area.width * (1 - ratio), 160), 320);
  const mainWidth = area.width - sidebarWidth - gap - padding * 2;
  const mainLeft = area.left + padding;
  const mainTop = area.top + padding;
  const mainHeight = area.height - padding * 2;

  Object.assign(frames, layoutEqualRegion(main, mainLeft, mainTop, mainWidth, mainHeight, gap));

  const itemHeight = (area.height - padding * 2 - gap * (others.length - 1)) / others.length;
  for (const [index, tile] of others.entries()) {
    frames[tile.key] = {
      left: area.left + padding + mainWidth + gap,
      top: area.top + padding + index * (itemHeight + gap),
      width: sidebarWidth,
      height: itemHeight,
    };
  }

  return frames;
}

export type AutoLayoutOptions = {
  sidebarSplitRatio?: number;
  speakerMainRatio?: number;
  pinnedTileKeys?: string[];
};

export function computeAutoLayoutFrames(
  tiles: StageTileEntry[],
  stage: StageGridLayout,
  preset: AutoLayoutPreset,
  activeSpeakerIdentity: string | null,
  options: AutoLayoutOptions = {}
): Record<string, TilePosition> {
  if (tiles.length === 0) return {};

  const pinnedTileKeys = options.pinnedTileKeys ?? [];
  const sidebarSplitRatio = options.sidebarSplitRatio ?? 0.72;
  const speakerMainRatio = options.speakerMainRatio ?? 0.72;

  switch (preset) {
    case "gallery":
      return layoutGallery(tiles, stage);
    case "speaker":
      return layoutSpeaker(tiles, stage, activeSpeakerIdentity, pinnedTileKeys, speakerMainRatio);
    case "sidebar":
      return layoutSidebar(tiles, stage, activeSpeakerIdentity, pinnedTileKeys, sidebarSplitRatio);
  }
}
