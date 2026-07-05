<script lang="ts">
  import EyeIcon from "@lucide/svelte/icons/eye";
  import EyeOffIcon from "@lucide/svelte/icons/eye-off";
  import Maximize2Icon from "@lucide/svelte/icons/maximize-2";
  import Minimize2Icon from "@lucide/svelte/icons/minimize-2";
  import PinIcon from "@lucide/svelte/icons/pin";

  type Props = {
    videoHidden?: boolean;
    fullscreen?: boolean;
    pinned?: boolean;
    showPin?: boolean;
    onMinimize?: () => void;
    onToggleHideVideo?: () => void;
    onToggleFullscreen?: () => void;
    onTogglePin?: () => void;
  };

  const {
    videoHidden = false,
    fullscreen = false,
    pinned = false,
    showPin = false,
    onMinimize,
    onToggleHideVideo,
    onToggleFullscreen,
    onTogglePin,
  }: Props = $props();

  const actionClass =
    "inline-flex size-8 items-center justify-center rounded-sm text-white/90 transition-colors hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 sm:size-6";
</script>

<div
  class="flex items-center gap-0.5 rounded-md bg-black/55 p-0.5 backdrop-blur-sm"
  data-grid-tile-handle="action"
  role="toolbar"
  aria-label="Tile actions"
  onpointerdown={(event) => event.stopPropagation()}
>
  {#if onMinimize}
    <button type="button" class={actionClass} aria-label="Minimize tile" onclick={onMinimize}>
      <Minimize2Icon class="size-3.5" aria-hidden="true" />
    </button>
  {/if}

  {#if showPin && onTogglePin}
    <button
      type="button"
      class="{actionClass} {pinned ? 'bg-white/20 text-white' : ''}"
      aria-label={pinned ? "Unpin spotlight" : "Pin spotlight"}
      aria-pressed={pinned}
      onclick={onTogglePin}
    >
      <PinIcon class="size-3.5" aria-hidden="true" />
    </button>
  {/if}

  {#if onToggleHideVideo}
    <button type="button" class={actionClass} aria-label={videoHidden ? "Show video" : "Hide video"} onclick={onToggleHideVideo}>
      {#if videoHidden}
        <EyeIcon class="size-3.5" aria-hidden="true" />
      {:else}
        <EyeOffIcon class="size-3.5" aria-hidden="true" />
      {/if}
    </button>
  {/if}

  {#if onToggleFullscreen}
    <button type="button" class={actionClass} aria-label={fullscreen ? "Exit tile fullscreen" : "Fullscreen tile"} onclick={onToggleFullscreen}>
      {#if fullscreen}
        <Minimize2Icon class="size-3.5" aria-hidden="true" />
      {:else}
        <Maximize2Icon class="size-3.5" aria-hidden="true" />
      {/if}
    </button>
  {/if}
</div>
