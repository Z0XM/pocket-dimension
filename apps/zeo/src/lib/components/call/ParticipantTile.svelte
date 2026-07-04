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
    localMicEnabled?: boolean;
    compact?: boolean;
  };

  const {
    participant,
    displayName,
    isActiveSpeaker = false,
    audioLevel = 0,
    tileColor,
    isGuest = false,
    isLocal = false,
    localMicEnabled,
    compact = false,
  }: Props = $props();

  let videoEl = $state<HTMLVideoElement | null>(null);
  let hasVideo = $derived(isCameraEnabled(participant));
  let micEnabled = $derived(isLocal && localMicEnabled !== undefined ? localMicEnabled : isMicrophoneEnabled(participant));

  const SPEAKING_THRESHOLD = 0.02;
  const clampedLevel = $derived(Math.min(1, Math.max(0, audioLevel)));
  const isSpeaking = $derived(micEnabled && clampedLevel > SPEAKING_THRESHOLD);
  const glowColor = (alpha: number) => `color-mix(in srgb, ${tileColor} ${alpha}%, transparent)`;

  const speakingGlowStyle = $derived.by(() => {
    if (!isSpeaking) return undefined;

    const innerBlur = 8 + clampedLevel * 14;
    const innerSpread = 2 + clampedLevel * 4;
    const innerAlpha = Math.round(20 + clampedLevel * 18);
    const outerBlur = 28 + clampedLevel * 36;
    const outerSpread = 5 + clampedLevel * 9;
    const outerAlpha = Math.round(12 + clampedLevel * 12);

    return `box-shadow: 0 0 ${innerBlur}px ${innerSpread}px ${glowColor(innerAlpha)}, 0 0 ${outerBlur}px ${outerSpread}px ${glowColor(outerAlpha)};`;
  });

  const speakingRingStyle = $derived.by(() => {
    if (isSpeaking) {
      return `outline: 2px solid ${glowColor(62)}; outline-offset: -2px; box-shadow: 0 0 18px 5px ${glowColor(26)};`;
    }
    if (isActiveSpeaker) {
      return `outline: 2px solid ${glowColor(42)}; outline-offset: -2px;`;
    }
    return undefined;
  });

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

<div class="rounded-lg transition-[box-shadow] duration-100 ease-out {compact ? 'aspect-video' : 'aspect-video'}" style={speakingGlowStyle}>
  <div
    class="relative size-full overflow-hidden rounded-lg bg-secondary transition-[box-shadow,outline] duration-100 ease-out"
    style={speakingRingStyle}
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
