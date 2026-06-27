<script lang="ts">
  import { Track, type LocalParticipant, type RemoteParticipant } from "livekit-client";
  import { initialsForName } from "$lib/livekit/types";
  import { isCameraEnabled, isMicrophoneEnabled } from "$lib/livekit/room-client";

  type Props = {
    participant: LocalParticipant | RemoteParticipant;
    displayName: string;
    isActiveSpeaker?: boolean;
    tileColor: string;
    isGuest?: boolean;
    isLocal?: boolean;
    compact?: boolean;
  };

  const { participant, displayName, isActiveSpeaker = false, tileColor, isGuest = false, isLocal = false, compact = false }: Props = $props();

  let videoEl = $state<HTMLVideoElement | null>(null);
  let hasVideo = $derived(isCameraEnabled(participant));

  $effect(() => {
    const el = videoEl;
    if (!el) return;

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

<div
  class="relative overflow-hidden rounded-lg bg-secondary ring-2 ring-transparent transition-shadow {compact
    ? 'aspect-video'
    : 'aspect-video'} {isActiveSpeaker ? 'ring-primary shadow-[0_0_0_1px_var(--primary)]' : ''}"
  aria-label="{displayName}{isLocal ? ' (you)' : ''}{isGuest ? ', guest' : ''}"
>
  {#if hasVideo}
    <video bind:this={videoEl} class="size-full object-cover" autoplay playsinline muted={isLocal}></video>
  {:else}
    <div class="flex size-full items-center justify-center" style="background-color: {tileColor}">
      <span class="text-3xl font-semibold text-primary-foreground/90">{initialsForName(displayName)}</span>
    </div>
  {/if}

  <div class="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/70 to-transparent px-3 py-2">
    <p class="truncate text-sm font-medium text-white">{displayName}{isLocal ? " (you)" : ""}</p>
    {#if isGuest}
      <span class="shrink-0 rounded bg-black/40 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-white/80">Guest</span>
    {/if}
    {#if !isMicrophoneEnabled(participant)}
      <span class="ml-auto shrink-0 text-xs text-white/80" aria-label="Muted">Muted</span>
    {/if}
  </div>
</div>
