<script lang="ts">
  import Maximize2Icon from "@lucide/svelte/icons/maximize-2";
  import Minimize2Icon from "@lucide/svelte/icons/minimize-2";
  import PinIcon from "@lucide/svelte/icons/pin";
  import VideoIcon from "@lucide/svelte/icons/video";
  import VideoOffIcon from "@lucide/svelte/icons/video-off";

  type Props = {
    videoHidden?: boolean;
    pinned?: boolean;
    fullscreen?: boolean;
    onMinimize?: () => void;
    onToggleHideVideo?: () => void;
    onTogglePin?: () => void;
    onToggleFullscreen?: () => void;
  };

  const { videoHidden = false, pinned = false, fullscreen = false, onMinimize, onToggleHideVideo, onTogglePin, onToggleFullscreen }: Props = $props();

  const actionClass =
    "inline-flex size-6 items-center justify-center rounded-sm text-white/90 transition-colors hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40";
</script>

<div
  class="flex items-center gap-0.5 rounded-md bg-black/55 p-0.5 backdrop-blur-sm"
  data-grid-tile-handle="action"
  role="toolbar"
  aria-label="Tile actions"
>
  {#if onMinimize}
    <button type="button" class={actionClass} aria-label="Minimize tile" onclick={onMinimize}>
      <Minimize2Icon class="size-3.5" aria-hidden="true" />
    </button>
  {/if}

  {#if onToggleHideVideo}
    <button type="button" class={actionClass} aria-label={videoHidden ? "Show video" : "Hide video"} onclick={onToggleHideVideo}>
      {#if videoHidden}
        <VideoIcon class="size-3.5" aria-hidden="true" />
      {:else}
        <VideoOffIcon class="size-3.5" aria-hidden="true" />
      {/if}
    </button>
  {/if}

  {#if onTogglePin}
    <button
      type="button"
      class="{actionClass} {pinned ? 'bg-white/15 text-white' : ''}"
      aria-label={pinned ? "Unpin tile" : "Pin tile"}
      aria-pressed={pinned}
      onclick={onTogglePin}
    >
      <PinIcon class="size-3.5" aria-hidden="true" />
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
