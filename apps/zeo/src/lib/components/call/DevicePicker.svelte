<script lang="ts">
  import MicIcon from "@lucide/svelte/icons/mic";
  import MicOffIcon from "@lucide/svelte/icons/mic-off";
  import SpeakerIcon from "@lucide/svelte/icons/speaker";
  import Volume2Icon from "@lucide/svelte/icons/volume-2";
  import VolumeOffIcon from "@lucide/svelte/icons/volume-off";
  import VideoIcon from "@lucide/svelte/icons/video";
  import VideoOffIcon from "@lucide/svelte/icons/video-off";
  import * as Select from "$lib/components/ui/select";
  import { IconControlButton } from "$lib/components/ui/icon-control-button";
  import type { MediaDeviceLists } from "$lib/livekit/devices";

  type Props = {
    devices: MediaDeviceLists;
    audioDeviceId: string;
    audioOutputDeviceId?: string;
    videoDeviceId: string;
    showAudioOutput?: boolean;
    speakerEnabled?: boolean;
    micEnabled?: boolean;
    camEnabled?: boolean;
    disabled?: boolean;
    deviceSelectDisabled?: boolean;
    layout?: "row" | "stack";
    onToggleMic?: () => void;
    onToggleSpeaker?: () => void;
    onToggleCam?: () => void;
    onAudioDeviceChange: (deviceId: string) => void;
    onAudioOutputDeviceChange?: (deviceId: string) => void;
    onVideoDeviceChange: (deviceId: string) => void;
  };

  const {
    devices,
    audioDeviceId,
    audioOutputDeviceId = "",
    videoDeviceId,
    showAudioOutput = false,
    speakerEnabled = true,
    micEnabled = true,
    camEnabled = true,
    disabled = false,
    deviceSelectDisabled = false,
    layout = "row",
    onToggleMic,
    onToggleSpeaker,
    onToggleCam,
    onAudioDeviceChange,
    onAudioOutputDeviceChange,
    onVideoDeviceChange,
  }: Props = $props();

  const audioOptions = $derived(devices.audioInputs.length === 0 ? [{ deviceId: "", label: "Default microphone" }] : devices.audioInputs);

  const videoOptions = $derived(devices.videoInputs.length === 0 ? [{ deviceId: "", label: "Default camera" }] : devices.videoInputs);

  const selectedAudioLabel = $derived(
    !micEnabled ? "Microphone off" : (audioOptions.find((device) => device.deviceId === audioDeviceId)?.label ?? "Default microphone")
  );

  const selectedVideoLabel = $derived(
    !camEnabled ? "Camera off" : (videoOptions.find((device) => device.deviceId === videoDeviceId)?.label ?? "Default camera")
  );

  const audioOutputOptions = $derived(devices.audioOutputs.length === 0 ? [{ deviceId: "", label: "Default speakers" }] : devices.audioOutputs);

  const selectedAudioOutputLabel = $derived(
    !speakerEnabled ? "Speakers muted" : (audioOutputOptions.find((device) => device.deviceId === audioOutputDeviceId)?.label ?? "Default speakers")
  );

  const audioSelectDisabled = $derived(disabled || deviceSelectDisabled || !micEnabled);
  const audioOutputSelectDisabled = $derived(disabled || deviceSelectDisabled || !speakerEnabled);
  const videoSelectDisabled = $derived(disabled || deviceSelectDisabled || !camEnabled);

  const deviceSelectContentClass =
    "device-select-content max-h-56 w-[var(--bits-select-anchor-width)] max-w-xs border border-border bg-card p-1 shadow-lg";
  const deviceSelectItemClass =
    "rounded-md py-2 pl-2 pr-8 text-sm focus:bg-secondary data-highlighted:bg-secondary data-selected:bg-secondary/70 focus:text-foreground data-highlighted:text-foreground [&_span]:line-clamp-2 [&_span:last-child]:whitespace-normal [&_span:last-child]:break-words";
  const rowClass = $derived(layout === "stack" ? "flex w-full items-center gap-2" : "flex min-w-[min(100%,12rem)] flex-1 items-center gap-2");
</script>

<div class={layout === "stack" ? "flex flex-col gap-2" : "flex flex-wrap items-center gap-3"}>
  <div class={rowClass}>
    {#if onToggleMic}
      <IconControlButton label={micEnabled ? "Mute microphone" : "Unmute microphone"} active={micEnabled} {disabled} onclick={onToggleMic}>
        {#if micEnabled}
          <MicIcon class="size-4 text-participant-orange" />
        {:else}
          <MicOffIcon class="size-4 text-muted-foreground" />
        {/if}
      </IconControlButton>
    {:else}
      <MicIcon class="size-5 shrink-0 text-participant-orange" aria-hidden="true" />
    {/if}

    <div class="min-w-0 flex-1">
      <Select.Root
        type="single"
        value={micEnabled ? audioDeviceId : ""}
        onValueChange={(value) => onAudioDeviceChange(value ?? "")}
        disabled={audioSelectDisabled}
      >
        <Select.Trigger id="audio-device" class="w-full min-w-0 cursor-pointer justify-between text-left" aria-label="Microphone">
          <span class="truncate">{selectedAudioLabel}</span>
        </Select.Trigger>
        <Select.Content class={deviceSelectContentClass} sideOffset={6}>
          {#each audioOptions as device (device.deviceId)}
            <Select.Item class={deviceSelectItemClass} value={device.deviceId} title={device.label}>
              {device.label}
            </Select.Item>
          {/each}
        </Select.Content>
      </Select.Root>
    </div>
  </div>

  {#if showAudioOutput && onAudioOutputDeviceChange}
    <div class={rowClass}>
      {#if onToggleSpeaker}
        <IconControlButton label={speakerEnabled ? "Mute speakers" : "Unmute speakers"} active={speakerEnabled} {disabled} onclick={onToggleSpeaker}>
          {#if speakerEnabled}
            <Volume2Icon class="size-4 text-participant-orange" />
          {:else}
            <VolumeOffIcon class="size-4 text-muted-foreground" />
          {/if}
        </IconControlButton>
      {:else}
        <SpeakerIcon class="size-5 shrink-0 text-participant-orange" aria-hidden="true" />
      {/if}

      <div class="min-w-0 flex-1">
        <Select.Root
          type="single"
          value={speakerEnabled ? audioOutputDeviceId : ""}
          onValueChange={(value) => onAudioOutputDeviceChange(value ?? "")}
          disabled={audioOutputSelectDisabled}
        >
          <Select.Trigger id="audio-output-device" class="w-full min-w-0 cursor-pointer justify-between text-left" aria-label="Speakers">
            <span class="truncate">{selectedAudioOutputLabel}</span>
          </Select.Trigger>
          <Select.Content class={deviceSelectContentClass} sideOffset={6}>
            {#each audioOutputOptions as device (device.deviceId)}
              <Select.Item class={deviceSelectItemClass} value={device.deviceId} title={device.label}>
                {device.label}
              </Select.Item>
            {/each}
          </Select.Content>
        </Select.Root>
      </div>
    </div>
  {/if}

  <div class={rowClass}>
    {#if onToggleCam}
      <IconControlButton label={camEnabled ? "Turn camera off" : "Turn camera on"} active={camEnabled} {disabled} onclick={onToggleCam}>
        {#if camEnabled}
          <VideoIcon class="size-4 text-participant-orange" />
        {:else}
          <VideoOffIcon class="size-4 text-muted-foreground" />
        {/if}
      </IconControlButton>
    {:else}
      <VideoIcon class="size-5 shrink-0 text-participant-orange" aria-hidden="true" />
    {/if}

    <div class="min-w-0 flex-1">
      <Select.Root
        type="single"
        value={camEnabled ? videoDeviceId : ""}
        onValueChange={(value) => onVideoDeviceChange(value ?? "")}
        disabled={videoSelectDisabled}
      >
        <Select.Trigger id="video-device" class="w-full min-w-0 cursor-pointer justify-between text-left" aria-label="Camera">
          <span class="truncate">{selectedVideoLabel}</span>
        </Select.Trigger>
        <Select.Content class={deviceSelectContentClass} sideOffset={6}>
          {#each videoOptions as device (device.deviceId)}
            <Select.Item class={deviceSelectItemClass} value={device.deviceId} title={device.label}>
              {device.label}
            </Select.Item>
          {/each}
        </Select.Content>
      </Select.Root>
    </div>
  </div>
</div>

<style>
  :global(.device-select-content [data-select-viewport]) {
    height: auto !important;
    max-height: 12rem;
  }
</style>
