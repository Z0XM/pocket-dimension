<script lang="ts">
  import { browser } from "$app/environment";
  import { onMount } from "svelte";
  import AudioLinesIcon from "@lucide/svelte/icons/audio-lines";
  import HeadphonesIcon from "@lucide/svelte/icons/headphones";
  import { IconControlButton } from "$lib/components/ui/icon-control-button";
  import { Tooltip, TooltipContent, TooltipTrigger } from "$lib/components/ui/tooltip";
  import { readStored, STORAGE_KEYS, writeStored } from "$lib/browser-storage";
  import { createPreviewAudioMonitor, type PreviewAudioMonitor } from "$lib/livekit/preview-audio-monitor";
  import type { MicGateProcessor } from "$lib/livekit/mic-gate-processor";
  import AudioLevelIndicator from "$lib/components/call/AudioLevelIndicator.svelte";

  type Props = {
    previewStream: MediaStream | null;
    micEnabled: boolean;
    speakerEnabled: boolean;
    permissionGranted: boolean;
    audioOutputDeviceId?: string;
    micGateProcessor?: MicGateProcessor | null;
    micTestActive?: boolean;
    layout?: "row" | "stack";
  };

  let {
    previewStream,
    micEnabled,
    speakerEnabled,
    permissionGranted,
    audioOutputDeviceId = "",
    micGateProcessor = null,
    micTestActive = $bindable(false),
    layout = "row",
  }: Props = $props();

  let monitor = $state<PreviewAudioMonitor | null>(null);

  let faderTrackEl = $state<HTMLDivElement | null>(null);
  let faderInnerEl = $state<HTMLDivElement | null>(null);
  let dragging = $state<"volume" | "cutoff" | null>(null);

  function trackPositionFromClientX(clientX: number) {
    const track = faderInnerEl ?? faderTrackEl;
    if (!track) return 0;

    const rect = track.getBoundingClientRect();
    if (rect.width <= 0) return 0;

    const ratio = (clientX - rect.left) / rect.width;
    return Math.min(100, Math.max(0, ratio * 100));
  }

  function applyDragPosition(clientX: number) {
    const position = trackPositionFromClientX(clientX);
    if (dragging === "volume") {
      setVolume(position);
    } else if (dragging === "cutoff") {
      setCutoff(position);
    }
  }

  function stopDragging(pointerId?: number) {
    if (!dragging) return;

    dragging = null;
    if (pointerId !== undefined) {
      faderTrackEl?.releasePointerCapture(pointerId);
    }
    window.removeEventListener("pointermove", onWindowPointerMove);
    window.removeEventListener("pointerup", onWindowPointerEnd);
    window.removeEventListener("pointercancel", onWindowPointerEnd);
  }

  function onWindowPointerMove(event: PointerEvent) {
    if (!dragging || !controlsEnabled) return;
    event.preventDefault();
    applyDragPosition(event.clientX);
  }

  function onWindowPointerEnd(event: PointerEvent) {
    stopDragging(event.pointerId);
  }

  function readStoredPercent(key: string, fallback: number) {
    const stored = readStored(key);
    if (!stored) return fallback;
    const parsed = Number.parseInt(stored, 10);
    if (Number.isNaN(parsed)) return fallback;
    return Math.min(100, Math.max(0, parsed));
  }

  let micOutputVolume = $state(readStoredPercent(STORAGE_KEYS.micOutputVolume, 75));
  let micInputCutoff = $state(readStoredPercent(STORAGE_KEYS.micInputCutoff, 5));
  let micLevel = $state(0);

  const controlsEnabled = $derived(permissionGranted && micEnabled);

  $effect(() => {
    monitor?.updateStream(previewStream);
  });

  $effect(() => {
    const volume = micOutputVolume / 100;
    monitor?.setVolume(volume);
    micGateProcessor?.setVolume(volume);
  });

  $effect(() => {
    const cutoff = micInputCutoff / 100;
    monitor?.setCutoff(cutoff);
    micGateProcessor?.setCutoff(cutoff);
  });

  $effect(() => {
    monitor?.setEnabled(micTestActive && controlsEnabled);
  });

  $effect(() => {
    if (monitor) void monitor.setSinkId(audioOutputDeviceId);
  });

  $effect(() => {
    monitor?.setOutputMuted(!speakerEnabled);
  });

  $effect(() => {
    if (!controlsEnabled && micTestActive) {
      micTestActive = false;
    }
  });

  $effect(() => {
    if (!speakerEnabled && micTestActive) {
      micTestActive = false;
    }
  });

  $effect(() => {
    if (!micTestActive || !controlsEnabled) {
      micLevel = 0;
      return;
    }

    let frame = 0;
    const tick = () => {
      micLevel = monitor?.getAudioLevel() ?? 0;
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  });

  function setVolume(value: number) {
    micOutputVolume = Math.min(100, Math.max(0, Math.round(value)));
    writeStored(STORAGE_KEYS.micOutputVolume, String(micOutputVolume));
  }

  function setCutoff(value: number) {
    micInputCutoff = Math.min(100, Math.max(0, Math.round(value)));
    writeStored(STORAGE_KEYS.micInputCutoff, String(micInputCutoff));
  }

  function pickDragTarget(clientX: number): "volume" | "cutoff" {
    const position = trackPositionFromClientX(clientX);
    const volumeDistance = Math.abs(position - micOutputVolume);
    const cutoffDistance = Math.abs(position - micInputCutoff);
    return volumeDistance <= cutoffDistance ? "volume" : "cutoff";
  }

  function onFaderPointerDown(event: PointerEvent) {
    if (!controlsEnabled) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;

    const track = faderTrackEl;
    if (!track) return;

    event.preventDefault();

    dragging = pickDragTarget(event.clientX);
    applyDragPosition(event.clientX);

    track.setPointerCapture(event.pointerId);
    window.addEventListener("pointermove", onWindowPointerMove, { passive: false });
    window.addEventListener("pointerup", onWindowPointerEnd);
    window.addEventListener("pointercancel", onWindowPointerEnd);
  }

  function onFaderLostPointerCapture() {
    stopDragging();
  }

  function onFaderKeyDown(event: KeyboardEvent) {
    if (!controlsEnabled) return;

    if (event.key === "ArrowUp" || event.key === "ArrowRight") {
      event.preventDefault();
      setVolume(micOutputVolume + 5);
    } else if (event.key === "ArrowDown" || event.key === "ArrowLeft") {
      event.preventDefault();
      setVolume(micOutputVolume - 5);
    } else if (event.key === "Home") {
      event.preventDefault();
      setVolume(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setVolume(100);
    } else if (event.key === "[") {
      event.preventDefault();
      setCutoff(micInputCutoff - 5);
    } else if (event.key === "]") {
      event.preventDefault();
      setCutoff(micInputCutoff + 5);
    }
  }

  /** Apply output routing during a user gesture (required by setSinkId). */
  export async function applyAudioOutputDevice(deviceId: string) {
    if (!monitor) return;
    await monitor.setSinkId(deviceId);
  }

  async function toggleMicTest() {
    if (!controlsEnabled) return;

    const next = !micTestActive;
    if (next && monitor) {
      await monitor.setSinkId(audioOutputDeviceId);
    }
    micTestActive = next;
  }

  onMount(() => {
    if (!browser) return;

    const instance = createPreviewAudioMonitor();
    monitor = instance;

    return () => {
      stopDragging();
      instance.destroy();
      monitor = null;
    };
  });
</script>

{#if browser && permissionGranted}
  <div class={layout === "stack" ? "flex w-full flex-col gap-2" : "w-full max-w-md space-y-1.5"}>
    <div class={layout === "stack" ? "flex w-full items-center gap-2" : "flex items-center gap-3"}>
      <Tooltip>
        <TooltipTrigger class="inline-flex size-10 shrink-0 items-center justify-center">
          <AudioLinesIcon class="size-4 text-participant-orange" aria-hidden="true" />
        </TooltipTrigger>
        <TooltipContent>input volume and noise cutoff</TooltipContent>
      </Tooltip>
      <div
        bind:this={faderTrackEl}
        class="volume-fader relative h-10 shrink-0 touch-none rounded-md border border-border bg-secondary/60 p-1.5 select-none {layout === 'stack'
          ? 'min-w-0 flex-1'
          : 'w-24'} {controlsEnabled ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}"
        role="slider"
        aria-label="input volume and noise cutoff"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={micOutputVolume}
        aria-disabled={!controlsEnabled}
        tabindex={controlsEnabled ? 0 : -1}
        onkeydown={onFaderKeyDown}
        onpointerdown={onFaderPointerDown}
        onlostpointercapture={onFaderLostPointerCapture}
      >
        <div bind:this={faderInnerEl} class="relative h-full w-full overflow-hidden rounded-sm bg-border/80">
          <div class="absolute inset-y-0 left-0 rounded-sm bg-muted/70" style="width: {micInputCutoff}%"></div>
          <div
            class="absolute inset-y-0 rounded-sm bg-participant-orange/85 {dragging ? '' : 'transition-[left,width] duration-75'}"
            style="left: {micInputCutoff}%; width: {Math.max(0, micOutputVolume - micInputCutoff)}%"
          ></div>
          <div
            class="cutoff-handle absolute inset-y-0.5 w-0.5 rounded-full bg-foreground/70 shadow-sm {dragging ? '' : 'transition-[left] duration-75'}"
            style="left: calc({micInputCutoff}% - 1px)"
            aria-hidden="true"
          ></div>
          <div
            class="volume-handle absolute inset-y-0.5 w-1 rounded-full bg-primary shadow-sm {dragging ? '' : 'transition-[left] duration-75'}"
            style="left: calc({micOutputVolume}% - 2px)"
            aria-hidden="true"
          ></div>
        </div>
      </div>
      <div class="flex shrink-0 flex-col items-end text-[10px] tabular-nums text-muted-foreground">
        <span title="noise cutoff">{micInputCutoff}%</span>
        <span title="input volume">{micOutputVolume}%</span>
      </div>

      {#if layout === "row"}
        {#if micTestActive}
          <AudioLevelIndicator class="shrink-0" level={micLevel} />
        {/if}
        <IconControlButton
          label={micTestActive ? "Stop mic test" : "Mic test"}
          active={micTestActive}
          disabled={!controlsEnabled}
          onclick={toggleMicTest}
        >
          <HeadphonesIcon class="size-4 {micTestActive ? 'text-participant-orange' : 'text-muted-foreground'}" />
        </IconControlButton>
      {/if}
    </div>

    {#if layout === "stack"}
      <div class="flex w-full items-center gap-2">
        <IconControlButton
          label={micTestActive ? "Stop mic test" : "Mic test"}
          active={micTestActive}
          disabled={!controlsEnabled}
          onclick={toggleMicTest}
        >
          <HeadphonesIcon class="size-4 {micTestActive ? 'text-participant-orange' : 'text-muted-foreground'}" />
        </IconControlButton>
        {#if micTestActive}
          <AudioLevelIndicator class="min-w-0 flex-1" level={micLevel} />
        {/if}
      </div>
    {/if}

    {#if micTestActive}
      <p class="text-[11px] leading-snug text-muted-foreground">
        Mic test active — drag the bright handle for volume and the thin handle for noise cutoff, then stop the test to enter the room.
      </p>
    {:else if !micEnabled}
      <p class="text-[11px] leading-snug text-muted-foreground">Turn on your microphone to adjust volume or run a mic test.</p>
    {/if}
  </div>
{/if}

<style>
  .volume-fader {
    touch-action: none;
    -webkit-user-select: none;
    user-select: none;
  }

  .volume-fader:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--participant-orange) 70%, transparent);
    outline-offset: 2px;
  }

  .cutoff-handle {
    pointer-events: none;
  }

  .volume-handle {
    pointer-events: none;
  }
</style>
