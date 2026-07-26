<script lang="ts">
  import {
    AUDIO_QUALITY_OPTIONS,
    VIDEO_QUALITY_OPTIONS,
    audioQualityLabel,
    type AudioQualityOption,
    type VideoQualityOption,
  } from "$lib/livekit/media-quality";

  type Props = {
    videoQuality: VideoQualityOption;
    audioQuality: AudioQualityOption;
    /** Skip outer frame when nested in another section. */
    embedded?: boolean;
    onVideoQualityChange: (value: VideoQualityOption) => void;
    onAudioQualityChange: (value: AudioQualityOption) => void;
  };

  const { videoQuality, audioQuality, embedded = false, onVideoQualityChange, onAudioQualityChange }: Props = $props();

  const chipClass =
    "rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  const activeClass = "border-participant-orange/50 bg-participant-orange/15 text-foreground";
  const idleClass = "border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground";
</script>

<div class="space-y-3 {embedded ? '' : 'rounded-lg border border-border px-3 py-3'}">
  <div class="space-y-2">
    <p class="text-sm font-medium text-foreground">Video quality</p>
    <div class="flex flex-wrap gap-1.5" role="group" aria-label="Video quality">
      {#each VIDEO_QUALITY_OPTIONS as option (option)}
        <button
          type="button"
          class="{chipClass} {videoQuality === option ? activeClass : idleClass}"
          aria-pressed={videoQuality === option}
          onclick={() => onVideoQualityChange(option)}
        >
          {option}
        </button>
      {/each}
    </div>
  </div>

  <div class="space-y-2">
    <p class="text-sm font-medium text-foreground">Audio quality</p>
    <div class="flex flex-wrap gap-1.5" role="group" aria-label="Audio quality">
      {#each AUDIO_QUALITY_OPTIONS as option (option)}
        <button
          type="button"
          class="{chipClass} {audioQuality === option ? activeClass : idleClass}"
          aria-pressed={audioQuality === option}
          onclick={() => onAudioQualityChange(option)}
        >
          {audioQualityLabel(option)}
        </button>
      {/each}
    </div>
  </div>

  <p class="text-xs text-muted-foreground">Applies to all your audio and video in this browser.</p>
</div>
