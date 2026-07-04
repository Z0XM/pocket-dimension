<script lang="ts">
  import type { Room } from "livekit-client";
  import { findScreenShareParticipant } from "$lib/livekit/screen-share";
  import type { ParticipantColor } from "$lib/participant-colors";
  import type { StageGridLayout } from "$lib/stage-grid";
  import ScreenShareLayout from "./ScreenShareLayout.svelte";
  import StageGridArea from "./StageGridArea.svelte";
  import VideoGrid from "./VideoGrid.svelte";

  type Props = {
    room: Room;
    activeSpeakerIdentity: string | null;
    audioLevels: Record<string, number>;
    localDisplayName: string;
    mediaRevision?: number;
    localMicEnabled?: boolean;
    localTileColor?: ParticipantColor | null;
    hideParticipantVideos?: boolean;
    disableSpeakingGlows?: boolean;
    bottomInset?: number;
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
    hideParticipantVideos = false,
    disableSpeakingGlows = false,
    bottomInset = 0,
    stageRef = $bindable(null),
  }: Props = $props();

  let stageEl = $state<HTMLElement | null>(null);
  let gridLayout = $state<StageGridLayout | null>(null);

  $effect(() => {
    stageRef = stageEl;
  });

  const screenSharer = $derived.by(() => {
    mediaRevision;
    return findScreenShareParticipant(room);
  });
</script>

<div bind:this={stageEl} class="relative size-full">
  {#if screenSharer}
    <div class="relative z-10 size-full">
      <ScreenShareLayout
        {room}
        {activeSpeakerIdentity}
        {audioLevels}
        {localDisplayName}
        {localMicEnabled}
        {localTileColor}
        {hideParticipantVideos}
        {disableSpeakingGlows}
      />
    </div>
  {:else}
    <StageGridArea {bottomInset} bind:layout={gridLayout}>
      {#snippet children({ layout })}
        <VideoGrid
          {room}
          {activeSpeakerIdentity}
          {audioLevels}
          {localDisplayName}
          gridLayout={layout}
          {localMicEnabled}
          {localTileColor}
          {hideParticipantVideos}
          {disableSpeakingGlows}
        />
      {/snippet}
    </StageGridArea>
  {/if}
</div>
