<script lang="ts">
  import { Track, type LocalParticipant, type RemoteParticipant } from "livekit-client";

  type Props = {
    participant: LocalParticipant | RemoteParticipant;
    isLocal?: boolean;
  };

  const { participant, isLocal = false }: Props = $props();

  let videoEl = $state<HTMLVideoElement | null>(null);

  $effect(() => {
    const el = videoEl;
    if (!el) return;

    const attach = () => {
      const publication = participant.getTrackPublication(Track.Source.ScreenShare);
      const track = publication?.videoTrack;
      if (track && publication?.isSubscribed !== false) {
        track.attach(el);
      }
    };

    const detach = () => {
      const publication = participant.getTrackPublication(Track.Source.ScreenShare);
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

<div class="relative size-full overflow-hidden rounded-lg bg-secondary">
  <video bind:this={videoEl} class="size-full object-contain bg-black" autoplay playsinline muted={isLocal}></video>
</div>
