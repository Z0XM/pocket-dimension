<script lang="ts">
  import { Track, type LocalParticipant, type RemoteParticipant } from "livekit-client";
  import { initialsForName } from "$lib/livekit/types";
  import { isCameraEnabled, isMicrophoneEnabled } from "$lib/livekit/room-client";
  import AudioLevelIndicator from "./AudioLevelIndicator.svelte";
  import HandGestureVideoOverlay from "./HandGestureVideoOverlay.svelte";
  import type { DetectedGesture, HandLandmark } from "$lib/gestures/gesture-types";

  type Props = {
    participant: LocalParticipant | RemoteParticipant;
    displayName: string;
    isActiveSpeaker?: boolean;
    audioLevel?: number;
    tileColor: string;
    teamOutlineColor?: string | null;
    isLocal?: boolean;
    localMicEnabled?: boolean;
    hideVideos?: boolean;
    disableSpeakingGlows?: boolean;
    mediaRevision?: number;
    compact?: boolean;
    fitContainer?: boolean;
    trackingOverlayVisible?: boolean;
    handLandmarks?: HandLandmark[] | null;
    handGesture?: DetectedGesture;
    handGestureHoldProgress?: number;
  };

  const {
    participant,
    displayName,
    isActiveSpeaker = false,
    audioLevel = 0,
    tileColor,
    teamOutlineColor = null,
    isLocal = false,
    localMicEnabled,
    hideVideos = false,
    disableSpeakingGlows = false,
    mediaRevision = 0,
    compact = false,
    fitContainer = false,
    trackingOverlayVisible = false,
    handLandmarks = null,
    handGesture = "none",
    handGestureHoldProgress = 0,
  }: Props = $props();

  let videoEl = $state<HTMLVideoElement | null>(null);
  let hasVideo = $derived.by(() => {
    mediaRevision;
    return isCameraEnabled(participant);
  });
  let showVideo = $derived(hasVideo && !hideVideos);
  let micEnabled = $derived(isLocal && localMicEnabled !== undefined ? localMicEnabled : isMicrophoneEnabled(participant));

  const SPEAKING_THRESHOLD = 0.02;
  const clampedLevel = $derived(Math.min(1, Math.max(0, audioLevel)));
  const isSpeaking = $derived(micEnabled && clampedLevel > SPEAKING_THRESHOLD);
  const glowColor = (alpha: number) => `color-mix(in srgb, ${tileColor} ${alpha}%, transparent)`;

  const speakingGlowStyle = $derived.by(() => {
    if (!isSpeaking || disableSpeakingGlows) return undefined;

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
      if (disableSpeakingGlows) {
        return `outline: 2px solid ${glowColor(62)}; outline-offset: -2px;`;
      }
      return `outline: 2px solid ${glowColor(62)}; outline-offset: -2px; box-shadow: 0 0 18px 5px ${glowColor(26)};`;
    }
    if (isActiveSpeaker) {
      return `outline: 2px solid ${glowColor(42)}; outline-offset: -2px;`;
    }
    if (teamOutlineColor) {
      return `outline: 3px solid ${teamOutlineColor}; outline-offset: 2px;`;
    }
    return undefined;
  });

  $effect(() => {
    const el = videoEl;
    if (!el || !showVideo) return;

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
    participant.on("trackPublished", attach);
    participant.on("trackUnpublished", detach);
    participant.on("trackMuted", attach);
    participant.on("trackUnmuted", attach);

    return () => {
      participant.off("trackSubscribed", attach);
      participant.off("trackUnsubscribed", detach);
      participant.off("trackPublished", attach);
      participant.off("trackUnpublished", detach);
      participant.off("trackMuted", attach);
      participant.off("trackUnmuted", attach);
      detach();
    };
  });
</script>

<div class="rounded-lg transition-[box-shadow] duration-100 ease-out {fitContainer ? 'size-full' : 'aspect-video'}" style={speakingGlowStyle}>
  <div
    class="relative size-full overflow-hidden rounded-lg bg-secondary transition-[box-shadow,outline] duration-100 ease-out"
    style={speakingRingStyle}
    aria-label="{displayName}{isLocal ? ' (you)' : ''}"
  >
    {#if showVideo}
      <video bind:this={videoEl} class="size-full object-cover {isLocal ? '-scale-x-100' : ''}" autoplay playsinline muted={isLocal}></video>
      {#if isLocal && trackingOverlayVisible}
        <HandGestureVideoOverlay
          {handLandmarks}
          gesture={handGesture}
          holdProgress={handGestureHoldProgress}
          visible={trackingOverlayVisible}
          mirrored
        />
      {/if}
    {:else}
      <div class="flex size-full items-center justify-center" style="background-color: {tileColor}">
        <span class="text-3xl font-semibold text-primary-foreground/90">{initialsForName(displayName)}</span>
      </div>
    {/if}

    <div class="absolute inset-x-0 bottom-0 z-[2] flex items-center gap-2 bg-gradient-to-t from-black/70 to-transparent px-3 py-2">
      <p class="truncate text-sm font-medium text-white">{displayName}{isLocal ? " (you)" : ""}</p>
      {#if !micEnabled}
        <span class="ml-auto shrink-0 text-xs text-white/80" aria-label="Muted">Muted</span>
      {:else}
        <AudioLevelIndicator class="ml-auto shrink-0" level={audioLevel} />
      {/if}
    </div>
  </div>
</div>
