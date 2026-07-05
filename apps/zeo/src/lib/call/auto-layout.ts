import type { StageTileEntry } from "$lib/call/stage-tiles";
import { computeParticipantGrid, tilePosition, type StageGridLayout, type TilePosition } from "$lib/stage-grid";

export type AutoLayoutPreset = "dynamic" | "gallery" | "speaker" | "sidebar";

export const AUTO_LAYOUT_PRESETS: Array<{
  id: AutoLayoutPreset;
  label: string;
}> = [
  { id: "dynamic", label: "Auto" },
  { id: "gallery", label: "Gallery" },
  { id: "speaker", label: "Speaker" },
  { id: "sidebar", label: "Sidebar" },
];

const AUTO_LAYOUT_PRESET_IDS = new Set<AutoLayoutPreset>(AUTO_LAYOUT_PRESETS.map((preset) => preset.id));

export function isAutoLayoutPreset(value: string | null): value is AutoLayoutPreset {
  return value !== null && AUTO_LAYOUT_PRESET_IDS.has(value as AutoLayoutPreset);
}

export function resolveAutoLayoutPreset(preset: AutoLayoutPreset, tiles: StageTileEntry[]): Exclude<AutoLayoutPreset, "dynamic"> | "gallery" {
  if (preset !== "dynamic") return preset;

  if (tiles.some((tile) => tile.kind === "screen-share")) return "sidebar";
  if (tiles.length <= 2) return "speaker";
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

function findPrimaryTileIndex(tiles: StageTileEntry[], activeSpeakerIdentity: string | null, pinnedTileKey: string | null) {
  if (pinnedTileKey) {
    const pinnedIndex = tiles.findIndex((tile) => tile.key === pinnedTileKey);
    if (pinnedIndex >= 0) return pinnedIndex;
  }

  const screenShareIndex = tiles.findIndex((tile) => tile.kind === "screen-share");
  if (screenShareIndex >= 0) return screenShareIndex;

  if (activeSpeakerIdentity) {
    const activeSpeakerIndex = tiles.findIndex((tile) => tile.kind === "participant" && tile.participant.identity === activeSpeakerIdentity);
    if (activeSpeakerIndex >= 0) return activeSpeakerIndex;
  }

  return 0;
}

function gallerySlotCount(tileCount: number, density: number) {
  const clamped = Math.min(10, Math.max(1, density));
  const multiplier = 1 + (clamped - 1) * 0.12;
  return Math.max(tileCount, Math.ceil(tileCount * multiplier));
}

function layoutGallery(tiles: StageTileEntry[], stage: StageGridLayout, density: number) {
  const grid = computeParticipantGrid(gallerySlotCount(tiles.length, density), stage);
  if (!grid) return {} as Record<string, TilePosition>;

  const frames: Record<string, TilePosition> = {};
  for (const [index, tile] of tiles.entries()) {
    frames[tile.key] = tilePosition(grid, index);
  }
  return frames;
}

function layoutSpeaker(tiles: StageTileEntry[], stage: StageGridLayout, activeSpeakerIdentity: string | null, pinnedTileKey: string | null) {
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

  const primaryIndex = findPrimaryTileIndex(tiles, activeSpeakerIdentity, pinnedTileKey);
  const primary = tiles[primaryIndex];
  const others = tiles.filter((_, index) => index !== primaryIndex);
  const frames: Record<string, TilePosition> = {};

  const stripHeight = Math.min(Math.max(area.height * 0.18, 72), 140);
  const mainTop = area.top + stripHeight + gap;
  const mainHeight = area.height - stripHeight - gap - padding * 2;

  frames[primary.key] = {
    left: area.left + padding,
    top: mainTop,
    width: area.width - padding * 2,
    height: mainHeight,
  };

  if (others.length === 0) return frames;

  const thumbWidth = (area.width - padding * 2 - gap * (others.length - 1)) / others.length;
  for (const [index, tile] of others.entries()) {
    frames[tile.key] = {
      left: area.left + padding + index * (thumbWidth + gap),
      top: area.top + padding,
      width: thumbWidth,
      height: stripHeight - padding,
    };
  }

  return frames;
}

function layoutSidebar(
  tiles: StageTileEntry[],
  stage: StageGridLayout,
  activeSpeakerIdentity: string | null,
  pinnedTileKey: string | null,
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

  const primaryIndex = findPrimaryTileIndex(tiles, activeSpeakerIdentity, pinnedTileKey);
  const primary = tiles[primaryIndex];
  const others = tiles.filter((_, index) => index !== primaryIndex);
  const frames: Record<string, TilePosition> = {};

  const ratio = Math.min(0.85, Math.max(0.55, splitRatio));
  const sidebarWidth = Math.min(Math.max(area.width * (1 - ratio), 160), 320);
  const mainWidth = area.width - sidebarWidth - gap - padding * 2;

  frames[primary.key] = {
    left: area.left + padding,
    top: area.top + padding,
    width: mainWidth,
    height: area.height - padding * 2,
  };

  if (others.length === 0) return frames;

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
  galleryDensity?: number;
  sidebarSplitRatio?: number;
  pinnedTileKey?: string | null;
};

export function computeAutoLayoutFrames(
  tiles: StageTileEntry[],
  stage: StageGridLayout,
  preset: AutoLayoutPreset,
  activeSpeakerIdentity: string | null,
  options: AutoLayoutOptions = {}
): Record<string, TilePosition> {
  if (tiles.length === 0) return {};

  const pinnedTileKey = options.pinnedTileKey ?? null;
  const galleryDensity = options.galleryDensity ?? 5;
  const sidebarSplitRatio = options.sidebarSplitRatio ?? 0.72;
  const resolved = resolveAutoLayoutPreset(preset, tiles);

  switch (resolved) {
    case "gallery":
      return layoutGallery(tiles, stage, galleryDensity);
    case "speaker":
      return layoutSpeaker(tiles, stage, activeSpeakerIdentity, pinnedTileKey);
    case "sidebar":
      return layoutSidebar(tiles, stage, activeSpeakerIdentity, pinnedTileKey, sidebarSplitRatio);
  }
}
