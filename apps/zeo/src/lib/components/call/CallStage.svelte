<script lang="ts">
  import type { Room } from "livekit-client";
  import { findScreenShareParticipant } from "$lib/livekit/screen-share";
  import VideoGrid from "./VideoGrid.svelte";
  import ScreenShareLayout from "./ScreenShareLayout.svelte";

  type Props = {
    room: Room;
    activeSpeakerIdentity: string | null;
    audioLevels: Record<string, number>;
    localDisplayName: string;
    mediaRevision?: number;
    stageRef?: HTMLElement | null;
  };

  let { room, activeSpeakerIdentity, audioLevels, localDisplayName, mediaRevision = 0, stageRef = $bindable(null) }: Props = $props();

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
    <VideoGrid {room} {activeSpeakerIdentity} {audioLevels} {localDisplayName} />
  {/if}
</div>
