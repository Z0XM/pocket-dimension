<script lang="ts">
  import EyeIcon from "@lucide/svelte/icons/eye";
  import EyeOffIcon from "@lucide/svelte/icons/eye-off";
  import XIcon from "@lucide/svelte/icons/x";
  import { AUTO_LAYOUT_PRESETS, type AutoLayoutPreset } from "$lib/call/auto-layout";
  import { SettingToggle } from "$lib/components/ui/setting-toggle";
  import type { StageLayoutMode } from "$lib/stage-grid";

  type LayoutOption = "grid" | AutoLayoutPreset;

  type Props = {
    layoutMode: StageLayoutMode;
    autoLayoutPreset: AutoLayoutPreset;
    bottomInset?: number;
    hideNonVideoTiles?: boolean;
    sidebarSplitRatio?: number;
    speakerMainRatio?: number;
    selfViewHidden?: boolean;
    onLayoutModeChange: (mode: StageLayoutMode) => void;
    onAutoLayoutPresetChange: (preset: AutoLayoutPreset) => void;
    onHideNonVideoTilesChange?: (value: boolean) => void;
    onSidebarSplitRatioChange?: (value: number) => void;
    onSpeakerMainRatioChange?: (value: number) => void;
    onHideSelfView?: () => void;
    onClose: () => void;
    layoutLocked?: boolean;
  };

  const {
    layoutMode,
    autoLayoutPreset,
    bottomInset = 0,
    hideNonVideoTiles = false,
    sidebarSplitRatio = 0.72,
    speakerMainRatio = 0.72,
    selfViewHidden = false,
    onLayoutModeChange,
    onAutoLayoutPresetChange,
    onHideNonVideoTilesChange,
    onSidebarSplitRatioChange,
    onSpeakerMainRatioChange,
    onHideSelfView,
    onClose,
    layoutLocked = false,
  }: Props = $props();

  const panelBottomPx = $derived(Math.max(16, bottomInset + 16));
  const showSidebarSplit = $derived(layoutMode === "auto" && autoLayoutPreset === "sidebar");
  const showSpeakerMain = $derived(layoutMode === "auto" && autoLayoutPreset === "speaker");

  const layoutOptions: Array<{ id: LayoutOption; label: string }> = [{ id: "grid", label: "Grid" }, ...AUTO_LAYOUT_PRESETS];

  function isSelected(option: LayoutOption) {
    if (option === "grid") return layoutMode === "grid";
    return layoutMode === "auto" && autoLayoutPreset === option;
  }

  function selectLayout(option: LayoutOption) {
    if (layoutLocked) return;
    if (option === "grid") {
      onLayoutModeChange("grid");
      return;
    }
    onLayoutModeChange("auto");
    onAutoLayoutPresetChange(option);
  }
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

  <div class="space-y-2">
    <p class="text-xs font-medium text-foreground">Layout</p>
    <div class="grid grid-cols-2 gap-2">
      {#each layoutOptions as option (option.id)}
        <button
          type="button"
          class="rounded-lg border px-3 py-2 text-center transition-colors disabled:cursor-not-allowed disabled:opacity-50 {isSelected(option.id)
            ? 'border-primary bg-primary/10 text-foreground'
            : 'border-border bg-secondary/30 text-muted-foreground hover:border-primary/30 hover:bg-secondary/60 hover:text-foreground'}"
          aria-pressed={isSelected(option.id)}
          disabled={layoutLocked}
          title={layoutLocked ? "End the game to change layout settings." : undefined}
          onclick={() => selectLayout(option.id)}
        >
          <span class="block text-sm font-medium">{option.label}</span>
        </button>
      {/each}
    </div>
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

  {#if showSpeakerMain && onSpeakerMainRatioChange}
    <div class="mt-4 space-y-2">
      <div class="flex items-center justify-between text-xs">
        <span class="font-medium text-foreground">Main stage height</span>
        <span class="text-muted-foreground">{Math.round(speakerMainRatio * 100)}%</span>
      </div>
      <input
        type="range"
        min="0.55"
        max="0.85"
        step="0.01"
        value={speakerMainRatio}
        class="w-full accent-primary"
        aria-label="Speaker main stage height"
        oninput={(event) => onSpeakerMainRatioChange(Number.parseFloat((event.currentTarget as HTMLInputElement).value))}
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
</div>
