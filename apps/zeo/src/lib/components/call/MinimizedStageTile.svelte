<script lang="ts">
  import { Track, type LocalParticipant, type RemoteParticipant } from "livekit-client";
  import { initialsForName } from "$lib/livekit/types";
  import { isCameraEnabled } from "$lib/livekit/room-client";
  import { tileColorForParticipant, type ParticipantColor } from "$lib/participant-colors";
  import ScreenShareVideo from "./ScreenShareVideo.svelte";

  type Props = {
    kind: "participant" | "screen-share";
    participant: LocalParticipant | RemoteParticipant;
    displayName: string;
    localIdentity: string;
    localTileColor?: ParticipantColor | null;
    videoHidden?: boolean;
    hideParticipantVideos?: boolean;
  };

  const { kind, participant, displayName, localIdentity, localTileColor, videoHidden = false, hideParticipantVideos = false }: Props = $props();

  let videoEl = $state<HTMLVideoElement | null>(null);

  const tileColor = $derived(
    tileColorForParticipant(participant.identity, {
      localIdentity,
      preferredColor: localTileColor,
    })
  );

  const showParticipantVideo = $derived(kind === "participant" && isCameraEnabled(participant) && !hideParticipantVideos && !videoHidden);

  $effect(() => {
    const el = videoEl;
    if (!el || kind !== "participant") return;

    const attach = () => {
      const publication = participant.getTrackPublication(Track.Source.Camera);
      const track = publication?.videoTrack;
      if (track && publication?.isSubscribed !== false) {
        track.attach(el);
      }
    };

    const detach = () => {
      const publication = participant.getTrackPublication(Track.Source.Camera);
      publication?.videoTrack?.detach(el);
    };

    attach();
    participant.on("trackSubscribed", attach);
    participant.on("trackUnsubscribed", detach);

    return () => {
      participant.off("trackSubscribed", attach);
      participant.off("trackUnsubscribed", detach);
      detach();
    };
  });
</script>

<div class="relative h-10 w-16 overflow-hidden rounded-md border border-border bg-secondary shadow-sm">
  {#if kind === "screen-share" && !videoHidden}
    <ScreenShareVideo {participant} isLocal={participant.identity === localIdentity} />
  {:else if showParticipantVideo}
    <video
      bind:this={videoEl}
      class="size-full object-cover {participant.identity === localIdentity ? '-scale-x-100' : ''}"
      autoplay
      playsinline
      muted
    ></video>
  {:else}
    <div class="flex size-full items-center justify-center" style="background-color: {tileColor}">
      <span class="text-xs font-semibold text-primary-foreground/90">{initialsForName(displayName)}</span>
    </div>
  {/if}

  <div class="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-black/60 px-1 py-0.5 text-[9px] font-medium text-white">
    {kind === "screen-share" ? "Screen" : displayName}
  </div>
</div>
