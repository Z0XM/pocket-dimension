<script lang="ts">
  import XIcon from "@lucide/svelte/icons/x";
  import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
  import DevicePicker from "$lib/components/call/DevicePicker.svelte";
  import MediaQualitySettings from "$lib/components/call/MediaQualitySettings.svelte";
  import MicPreviewControls from "$lib/components/call/MicPreviewControls.svelte";
  import TileColorPicker from "$lib/components/call/TileColorPicker.svelte";
  import GestureSettings from "$lib/components/call/GestureSettings.svelte";
  import { Separator } from "$lib/components/ui/separator";
  import { SettingToggle } from "$lib/components/ui/setting-toggle";
  import type { MediaDeviceLists } from "$lib/livekit/devices";
  import type { MicGateProcessor } from "$lib/livekit/mic-gate-processor";
  import type { AudioQualityOption, VideoQualityOption } from "$lib/livekit/media-quality";
  import type { ParticipantColor } from "$lib/participant-colors";
  import { CAMERA_IN_USE_MESSAGE } from "$lib/livekit/media-errors";

  type Props = {
    cameraInUse?: boolean;
    micDeviceError?: string | null;
    devices: MediaDeviceLists;
    audioDeviceId: string;
    audioOutputDeviceId: string;
    videoDeviceId: string;
    showAudioOutput: boolean;
    micEnabled: boolean;
    speakerEnabled: boolean;
    camEnabled: boolean;
    micTestActive: boolean;
    micMonitorStream: MediaStream | null;
    micGateProcessor: MicGateProcessor | null;
    permissionGranted: boolean;
    tileColor: ParticipantColor;
    gesturesEnabled: boolean;
    gestureOverlayVisible: boolean;
    gestureCameraAvailable: boolean;
    videoQuality: VideoQualityOption;
    audioQuality: AudioQualityOption;
    hideParticipantVideos: boolean;
    disableSpeakingGlows: boolean;
    showTileStats: boolean;
    isHost: boolean;
    roomIsLocked: boolean;
    updatingRoomLock: boolean;
    micPreviewControls?: MicPreviewControls | null;
    onClose: () => void;
    onRetryCamera: () => void;
    onRetryMicrophone: () => void;
    onToggleMic: () => void;
    onToggleSpeaker: () => void;
    onToggleCam: () => void;
    onAudioDeviceChange: (deviceId: string) => void;
    onAudioOutputDeviceChange: (deviceId: string) => void;
    onVideoDeviceChange: (deviceId: string) => void;
    onTileColorChange: (color: ParticipantColor) => void;
    onGesturesEnabledChange: (enabled: boolean) => void;
    onOverlayVisibleChange: (visible: boolean) => void;
    onVideoQualityChange: (value: VideoQualityOption) => void;
    onAudioQualityChange: (value: AudioQualityOption) => void;
    onHideParticipantVideosChange: (value: boolean) => void;
    onDisableSpeakingGlowsChange: (value: boolean) => void;
    onShowTileStatsChange: (value: boolean) => void;
    onRoomLockChange: (value: boolean) => void;
  };

  let {
    cameraInUse = false,
    micDeviceError = null,
    devices,
    audioDeviceId,
    audioOutputDeviceId,
    videoDeviceId,
    showAudioOutput,
    micEnabled,
    speakerEnabled,
    camEnabled,
    micTestActive = $bindable(false),
    micMonitorStream,
    micGateProcessor,
    permissionGranted,
    tileColor,
    gesturesEnabled,
    gestureOverlayVisible,
    gestureCameraAvailable,
    videoQuality,
    audioQuality,
    hideParticipantVideos,
    disableSpeakingGlows,
    showTileStats,
    isHost,
    roomIsLocked,
    updatingRoomLock,
    micPreviewControls = $bindable(null),
    onClose,
    onRetryCamera,
    onRetryMicrophone,
    onToggleMic,
    onToggleSpeaker,
    onToggleCam,
    onAudioDeviceChange,
    onAudioOutputDeviceChange,
    onVideoDeviceChange,
    onTileColorChange,
    onGesturesEnabledChange,
    onOverlayVisibleChange,
    onVideoQualityChange,
    onAudioQualityChange,
    onHideParticipantVideosChange,
    onDisableSpeakingGlowsChange,
    onShowTileStatsChange,
    onRoomLockChange,
  }: Props = $props();

  let openAccordion = $state<Record<string, boolean>>({
    devices: true,
    gestures: false,
    quality: false,
    display: false,
  });

  function toggleAccordion(id: string) {
    openAccordion = { ...openAccordion, [id]: !openAccordion[id] };
  }
</script>

<div
  class="absolute inset-x-0 top-0 z-40 max-h-[min(72dvh,100%)] overflow-y-auto rounded-b-xl border border-border bg-card/95 p-4 shadow-lg backdrop-blur-sm safe-top safe-x sm:inset-x-auto sm:left-4 sm:top-4 sm:max-h-[min(72dvh,100%)] sm:w-full sm:max-w-md sm:rounded-xl"
>
  <div class="mb-3 flex items-center justify-between gap-3">
    <p class="text-sm font-medium text-foreground">Settings</p>
    <button type="button" class="action-btn-ghost-destructive size-11 sm:size-7" aria-label="Close settings" onclick={onClose}>
      <XIcon class="size-4" aria-hidden="true" />
    </button>
  </div>

  <div class="space-y-2">
    {#if cameraInUse}
      <div class="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
        <p>{CAMERA_IN_USE_MESSAGE}</p>
        <button type="button" class="mt-2 underline" onclick={onRetryCamera}>Retry camera</button>
      </div>
    {/if}
    {#if micDeviceError}
      <div class="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
        <p>{micDeviceError}</p>
        <button type="button" class="mt-2 underline" onclick={onRetryMicrophone}>Retry microphone</button>
      </div>
    {/if}

    <div class="overflow-hidden rounded-lg border border-border">
      <button
        type="button"
        class="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-medium text-foreground hover:bg-secondary/60"
        aria-expanded={openAccordion.devices}
        onclick={() => toggleAccordion("devices")}
      >
        <span>Devices & color</span>
        <ChevronDownIcon
          class="size-4 shrink-0 text-muted-foreground transition-transform {openAccordion.devices ? 'rotate-180' : ''}"
          aria-hidden="true"
        />
      </button>
      {#if openAccordion.devices}
        <div class="space-y-3 border-t border-border px-3 py-3">
          <DevicePicker
            layout="stack"
            {devices}
            {audioDeviceId}
            {audioOutputDeviceId}
            {videoDeviceId}
            {showAudioOutput}
            {micEnabled}
            {speakerEnabled}
            {camEnabled}
            {onToggleMic}
            {onToggleSpeaker}
            {onToggleCam}
            {onAudioDeviceChange}
            {onAudioOutputDeviceChange}
            {onVideoDeviceChange}
          />
          <MicPreviewControls
            bind:this={micPreviewControls}
            layout="stack"
            helpContext="incall"
            bind:micTestActive
            previewStream={micMonitorStream}
            {micEnabled}
            {speakerEnabled}
            {audioOutputDeviceId}
            {micGateProcessor}
            {permissionGranted}
          />
          <TileColorPicker compact value={tileColor} onChange={onTileColorChange} />
        </div>
      {/if}
    </div>

    <div class="overflow-hidden rounded-lg border border-border">
      <button
        type="button"
        class="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-medium text-foreground hover:bg-secondary/60"
        aria-expanded={openAccordion.gestures}
        onclick={() => toggleAccordion("gestures")}
      >
        <span>Hand gestures</span>
        <ChevronDownIcon
          class="size-4 shrink-0 text-muted-foreground transition-transform {openAccordion.gestures ? 'rotate-180' : ''}"
          aria-hidden="true"
        />
      </button>
      {#if openAccordion.gestures}
        <div class="border-t border-border px-3 py-1">
          <GestureSettings
            embedded
            {gesturesEnabled}
            overlayVisible={gestureOverlayVisible}
            cameraAvailable={gestureCameraAvailable}
            {onGesturesEnabledChange}
            {onOverlayVisibleChange}
          />
        </div>
      {/if}
    </div>

    <div class="overflow-hidden rounded-lg border border-border">
      <button
        type="button"
        class="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-medium text-foreground hover:bg-secondary/60"
        aria-expanded={openAccordion.quality}
        onclick={() => toggleAccordion("quality")}
      >
        <span>Quality</span>
        <ChevronDownIcon
          class="size-4 shrink-0 text-muted-foreground transition-transform {openAccordion.quality ? 'rotate-180' : ''}"
          aria-hidden="true"
        />
      </button>
      {#if openAccordion.quality}
        <div class="border-t border-border px-3 py-3">
          <MediaQualitySettings embedded {videoQuality} {audioQuality} {onVideoQualityChange} {onAudioQualityChange} />
        </div>
      {/if}
    </div>

    <div class="overflow-hidden rounded-lg border border-border">
      <button
        type="button"
        class="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-medium text-foreground hover:bg-secondary/60"
        aria-expanded={openAccordion.display}
        onclick={() => toggleAccordion("display")}
      >
        <span>Display & room</span>
        <ChevronDownIcon
          class="size-4 shrink-0 text-muted-foreground transition-transform {openAccordion.display ? 'rotate-180' : ''}"
          aria-hidden="true"
        />
      </button>
      {#if openAccordion.display}
        <div class="border-t border-border px-3 py-1">
          <SettingToggle
            id="hide-participant-videos"
            label="Hide participant videos"
            tooltip="Show colored initials instead of camera feeds for everyone in the grid."
            checked={hideParticipantVideos}
            onCheckedChange={onHideParticipantVideosChange}
          />
          <Separator />
          <SettingToggle
            id="disable-speaking-glows"
            label="Hide speaking glows"
            tooltip="Turn off the outer glow when someone speaks. The colored outline still appears."
            checked={disableSpeakingGlows}
            onCheckedChange={onDisableSpeakingGlowsChange}
          />
          <Separator />
          <SettingToggle
            id="show-tile-stats"
            label="Show tile stats"
            tooltip="Ping, video/audio quality, and fps on every tile."
            checked={showTileStats}
            onCheckedChange={onShowTileStatsChange}
          />
          {#if isHost}
            <Separator />
            <SettingToggle
              id="room-lock"
              label="Lock room"
              tooltip="Block new participants from joining while the room stays active."
              checked={roomIsLocked}
              disabled={updatingRoomLock}
              onCheckedChange={onRoomLockChange}
            />
          {/if}
        </div>
      {/if}
    </div>
  </div>
</div>
