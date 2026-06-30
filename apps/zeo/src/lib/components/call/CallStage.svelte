<script lang="ts">
  import type { Room } from "livekit-client";
  import { findScreenShareParticipant } from "$lib/livekit/screen-share";
  import type { CallTileLayout } from "$lib/call/grid/types";
  import VideoGrid from "./VideoGrid.svelte";
  import ScreenShareLayout from "./ScreenShareLayout.svelte";

  type Props = {
    room: Room;
    activeSpeakerIdentity: string | null;
    audioLevels: Record<string, number>;
    localDisplayName: string;
    mediaRevision?: number;
    layoutEditMode?: boolean;
    tileLayout?: CallTileLayout | null;
    onLayoutChange?: (layout: CallTileLayout) => void;
    stageRef?: HTMLElement | null;
  };

  let {
    room,
    activeSpeakerIdentity,
    audioLevels,
    localDisplayName,
    mediaRevision = 0,
    layoutEditMode = false,
    tileLayout = null,
    onLayoutChange = () => {},
    stageRef = $bindable(null),
  }: Props = $props();

  let stageEl = $state<HTMLElement | null>(null);

  $effect(() => {
    stageRef = stageEl;
  });

  const screenSharer = $derived.by(() => {
    mediaRevision;
    return findScreenShareParticipant(room);
  });
</script>

<div bind:this={stageEl} class="size-full">
  {#if screenSharer}
    <ScreenShareLayout {room} {activeSpeakerIdentity} {audioLevels} {localDisplayName} />
  {:else}
    <VideoGrid {room} {activeSpeakerIdentity} {audioLevels} {localDisplayName} {layoutEditMode} {tileLayout} {onLayoutChange} />
  {/if}
</div>
