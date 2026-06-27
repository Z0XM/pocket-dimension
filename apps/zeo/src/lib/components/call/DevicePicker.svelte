<script lang="ts">
  import type { MediaDeviceLists } from "$lib/livekit/devices";

  type Props = {
    devices: MediaDeviceLists;
    audioDeviceId: string;
    videoDeviceId: string;
    disabled?: boolean;
    onAudioDeviceChange: (deviceId: string) => void;
    onVideoDeviceChange: (deviceId: string) => void;
  };

  const { devices, audioDeviceId, videoDeviceId, disabled = false, onAudioDeviceChange, onVideoDeviceChange }: Props = $props();
</script>

<div class="grid gap-3 sm:grid-cols-2">
  <div class="space-y-1.5">
    <label for="audio-device" class="text-sm font-medium text-foreground">Microphone</label>
    <select
      id="audio-device"
      class="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
      {disabled}
      value={audioDeviceId}
      onchange={(e) => onAudioDeviceChange(e.currentTarget.value)}
    >
      {#if devices.audioInputs.length === 0}
        <option value="">Default microphone</option>
      {:else}
        {#each devices.audioInputs as device (device.deviceId)}
          <option value={device.deviceId}>{device.label}</option>
        {/each}
      {/if}
    </select>
  </div>

  <div class="space-y-1.5">
    <label for="video-device" class="text-sm font-medium text-foreground">Camera</label>
    <select
      id="video-device"
      class="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
      {disabled}
      value={videoDeviceId}
      onchange={(e) => onVideoDeviceChange(e.currentTarget.value)}
    >
      {#if devices.videoInputs.length === 0}
        <option value="">Default camera</option>
      {:else}
        {#each devices.videoInputs as device (device.deviceId)}
          <option value={device.deviceId}>{device.label}</option>
        {/each}
      {/if}
    </select>
  </div>
</div>
