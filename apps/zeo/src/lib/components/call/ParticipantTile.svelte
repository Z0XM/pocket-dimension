<script lang="ts">
  import { Track, type LocalParticipant, type RemoteParticipant } from "livekit-client";
  import { initialsForName } from "$lib/livekit/types";
  import { isCameraEnabled, isMicrophoneEnabled } from "$lib/livekit/room-client";
  import AudioLevelIndicator from "./AudioLevelIndicator.svelte";

  type Props = {
    participant: LocalParticipant | RemoteParticipant;
    displayName: string;
    isActiveSpeaker?: boolean;
    audioLevel?: number;
    tileColor: string;
    isGuest?: boolean;
    isLocal?: boolean;
    compact?: boolean;
    fillContainer?: boolean;
    layoutEditable?: boolean;
  };

  const {
    participant,
    displayName,
    isActiveSpeaker = false,
    audioLevel = 0,
    tileColor,
    isGuest = false,
    isLocal = false,
    compact = false,
    fillContainer = false,
    layoutEditable = false,
  }: Props = $props();

  let videoEl = $state<HTMLVideoElement | null>(null);
  let hasVideo = $derived(isCameraEnabled(participant));
  let micEnabled = $derived(isMicrophoneEnabled(participant));

  const SPEAKING_THRESHOLD = 0.02;
  const clampedLevel = $derived(Math.min(1, Math.max(0, audioLevel)));
  const isSpeaking = $derived(micEnabled && clampedLevel > SPEAKING_THRESHOLD);
  const speakingGlowStyle = $derived(
    isSpeaking
      ? `box-shadow: 0 0 ${6 + clampedLevel * 18}px ${clampedLevel * 2}px color-mix(in srgb, var(--participant-purple) ${Math.round(20 + clampedLevel * 50)}%, transparent);`
      : undefined
  );

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

<div class="{fillContainer ? 'size-full min-h-0' : 'aspect-video'} rounded-lg transition-[box-shadow] duration-75 ease-out" style={speakingGlowStyle}>
  <div
    class="relative size-full overflow-hidden rounded-lg bg-secondary ring-2 ring-transparent transition-shadow {isActiveSpeaker
      ? 'ring-participant-purple/70 shadow-[0_0_0_1px_color-mix(in_srgb,var(--participant-purple)_70%,transparent)]'
      : ''} {layoutEditable ? 'ring-border/80' : ''}"
    aria-label="{displayName}{isLocal ? ' (you)' : ''}{isGuest ? ', guest' : ''}"
  >
    {#if hasVideo}
      <video bind:this={videoEl} class="size-full object-cover {isLocal ? '-scale-x-100' : ''}" autoplay playsinline muted={isLocal}></video>
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
      {#if !micEnabled}
        <span class="ml-auto shrink-0 text-xs text-white/80" aria-label="Muted">Muted</span>
      {:else}
        <AudioLevelIndicator class="ml-auto shrink-0" level={audioLevel} />
      {/if}
    </div>
  </div>
</div>
