<script lang="ts">
  import type { Room } from "livekit-client";
  import { findScreenShareParticipant } from "$lib/livekit/screen-share";
  import type { ParticipantColor } from "$lib/participant-colors";
  import ScreenShareLayout from "./ScreenShareLayout.svelte";
  import VideoGrid from "./VideoGrid.svelte";

  type Props = {
    room: Room;
    activeSpeakerIdentity: string | null;
    audioLevels: Record<string, number>;
    localDisplayName: string;
    mediaRevision?: number;
    localMicEnabled?: boolean;
    localTileColor?: ParticipantColor | null;
    stageRef?: HTMLElement | null;
  };

  let {
    room,
    activeSpeakerIdentity,
    audioLevels,
    localDisplayName,
    mediaRevision = 0,
    localMicEnabled,
    localTileColor,
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
    <ScreenShareLayout {room} {activeSpeakerIdentity} {audioLevels} {localDisplayName} {localMicEnabled} {localTileColor} />
  {:else}
    <VideoGrid {room} {activeSpeakerIdentity} {audioLevels} {localDisplayName} {localMicEnabled} {localTileColor} />
  {/if}
</div>
