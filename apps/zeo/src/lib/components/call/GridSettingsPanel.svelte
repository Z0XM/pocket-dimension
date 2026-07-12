<script lang="ts">
  import EyeIcon from "@lucide/svelte/icons/eye";
  import EyeOffIcon from "@lucide/svelte/icons/eye-off";
  import XIcon from "@lucide/svelte/icons/x";
  import { AUTO_LAYOUT_PRESETS, type AutoLayoutPreset } from "$lib/call/auto-layout";
  import { SettingToggle } from "$lib/components/ui/setting-toggle";
  import type { StageLayoutMode } from "$lib/stage-grid";

  type Props = {
    layoutMode: StageLayoutMode;
    autoLayoutPreset: AutoLayoutPreset;
    bottomInset?: number;
    hideNonVideoTiles?: boolean;
    galleryDensity?: number;
    sidebarSplitRatio?: number;
    selfViewHidden?: boolean;
    onLayoutModeChange: (mode: StageLayoutMode) => void;
    onAutoLayoutPresetChange: (preset: AutoLayoutPreset) => void;
    onHideNonVideoTilesChange?: (value: boolean) => void;
    onGalleryDensityChange?: (value: number) => void;
    onSidebarSplitRatioChange?: (value: number) => void;
    onHideSelfView?: () => void;
    onClose: () => void;
    layoutLocked?: boolean;
  };

  const {
    layoutMode,
    autoLayoutPreset,
    bottomInset = 0,
    hideNonVideoTiles = false,
    galleryDensity = 5,
    sidebarSplitRatio = 0.72,
    selfViewHidden = false,
    onLayoutModeChange,
    onAutoLayoutPresetChange,
    onHideNonVideoTilesChange,
    onGalleryDensityChange,
    onSidebarSplitRatioChange,
    onHideSelfView,
    onClose,
    layoutLocked = false,
  }: Props = $props();

  const manualGrid = $derived(layoutMode === "grid");
  const viewLabel = $derived(manualGrid ? "Grid View" : "Auto View");
  const panelBottomPx = $derived(Math.max(16, bottomInset + 16));
  const showGalleryDensity = $derived(!manualGrid && (autoLayoutPreset === "gallery" || autoLayoutPreset === "dynamic"));
  const showSidebarSplit = $derived(!manualGrid && (autoLayoutPreset === "sidebar" || autoLayoutPreset === "dynamic"));
</script>

<div
  class="absolute inset-x-2 z-30 w-auto max-w-xs rounded-xl border border-border bg-card/95 p-4 shadow-lg backdrop-blur-sm safe-x sm:left-4 sm:inset-x-auto sm:max-h-[min(28rem,calc(100dvh-6rem))] sm:overflow-y-auto"
  style:bottom="{panelBottomPx}px"
>
  <div class="mb-3 flex items-center justify-between">
    <p class="text-sm font-medium text-foreground">Grid settings</p>
    <button type="button" class="action-btn-ghost-destructive size-11 sm:size-7" aria-label="Close grid settings" onclick={onClose}>
      <XIcon class="size-4" aria-hidden="true" />
    </button>
  </div>

  <div class="rounded-lg border border-border px-3">
    <SettingToggle
      id="manual-grid-layout"
      label={viewLabel}
      tooltip={layoutLocked
        ? "End the game to change layout settings."
        : manualGrid
          ? "Grid View shows the stage grid and lets you drag and resize tiles."
          : "Auto View arranges and sizes tiles automatically without grid guides."}
      checked={manualGrid}
      disabled={layoutLocked}
      onCheckedChange={(checked) => {
        if (layoutLocked) return;
        onLayoutModeChange(checked ? "grid" : "auto");
      }}
    />
  </div>

  {#if onHideSelfView}
    <button
      type="button"
      class="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm text-foreground transition-colors hover:bg-secondary/60"
      onclick={onHideSelfView}
    >
      {#if selfViewHidden}
        <EyeIcon class="size-4" aria-hidden="true" />
        Show self view
      {:else}
        <EyeOffIcon class="size-4" aria-hidden="true" />
        Hide self view
      {/if}
    </button>
  {/if}

  {#if onHideNonVideoTilesChange}
    <div class="mt-3 rounded-lg border border-border px-3">
      <SettingToggle
        id="hide-non-video-tiles"
        label="Hide camera-off tiles"
        tooltip="Remove tiles for participants who turned their camera off."
        checked={hideNonVideoTiles}
        onCheckedChange={onHideNonVideoTilesChange}
      />
    </div>
  {/if}

  {#if !manualGrid}
    <div class="mt-4 space-y-2">
      <p class="text-xs font-medium text-foreground">Layout</p>
      <div class="grid grid-cols-2 gap-2">
        {#each AUTO_LAYOUT_PRESETS as preset (preset.id)}
          <button
            type="button"
            class="rounded-lg border px-3 py-2 text-left transition-colors {autoLayoutPreset === preset.id
              ? 'border-primary bg-primary/10 text-foreground'
              : 'border-border bg-secondary/30 text-muted-foreground hover:border-primary/30 hover:bg-secondary/60 hover:text-foreground'}"
            aria-pressed={autoLayoutPreset === preset.id}
            onclick={() => onAutoLayoutPresetChange(preset.id)}
          >
            <span class="block text-sm font-medium">{preset.label}</span>
          </button>
        {/each}
      </div>
    </div>

    {#if showGalleryDensity && onGalleryDensityChange}
      <div class="mt-4 space-y-2">
        <div class="flex items-center justify-between text-xs">
          <span class="font-medium text-foreground">Gallery density</span>
          <span class="text-muted-foreground">{galleryDensity}/10</span>
        </div>
        <input
          type="range"
          min="1"
          max="10"
          step="1"
          value={galleryDensity}
          class="w-full accent-primary"
          aria-label="Gallery density"
          oninput={(event) => onGalleryDensityChange(Number.parseInt((event.currentTarget as HTMLInputElement).value, 10))}
        />
      </div>
    {/if}

    {#if showSidebarSplit && onSidebarSplitRatioChange}
      <div class="mt-4 space-y-2">
        <div class="flex items-center justify-between text-xs">
          <span class="font-medium text-foreground">Main stage width</span>
          <span class="text-muted-foreground">{Math.round(sidebarSplitRatio * 100)}%</span>
        </div>
        <input
          type="range"
          min="0.55"
          max="0.85"
          step="0.01"
          value={sidebarSplitRatio}
          class="w-full accent-primary"
          aria-label="Sidebar split ratio"
          oninput={(event) => onSidebarSplitRatioChange(Number.parseFloat((event.currentTarget as HTMLInputElement).value))}
        />
      </div>
    {/if}
  {/if}
</div>
