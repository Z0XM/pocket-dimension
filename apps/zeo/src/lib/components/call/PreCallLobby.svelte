<script lang="ts">
  import HashIcon from "@lucide/svelte/icons/hash";
  import { Badge } from "$lib/components/ui/badge";
  import { Button } from "$lib/components/ui/button";
  import { Card, CardContent, CardHeader, CardTitle } from "$lib/components/ui/card";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { Separator } from "$lib/components/ui/separator";
  import { SettingToggle } from "$lib/components/ui/setting-toggle";
  import DevicePicker from "$lib/components/call/DevicePicker.svelte";
  import MicPreviewControls from "$lib/components/call/MicPreviewControls.svelte";
  import type { MicGateProcessor } from "$lib/livekit/mic-gate-processor";
  import type { MediaDeviceLists } from "$lib/livekit/devices";
  import type { PermissionState } from "$lib/livekit/types";
  import { syncPreviewTracks } from "$lib/livekit/media-preview";

  type Props = {
    slug: string;
    roomTitle: string;
    hostName: string;
    participantCount: number;
    maxParticipants: number;
    isGuest: boolean;
    isHost: boolean;
    isPublic: boolean;
    waitingRoomEnabled?: boolean;
    isStale?: boolean;
    guestName: string;
    userDisplayName?: string | null;
    micEnabled: boolean;
    speakerEnabled: boolean;
    camEnabled: boolean;
    permissionState: PermissionState;
    previewStream: MediaStream | null;
    devices: MediaDeviceLists;
    audioDeviceId: string;
    audioOutputDeviceId?: string;
    videoDeviceId: string;
    showAudioOutput?: boolean;
    joining: boolean;
    canJoin: boolean;
    micTestActive?: boolean;
    micGateProcessor?: MicGateProcessor | null;
    updatingVisibility?: boolean;
    onGuestNameChange: (value: string) => void;
    onToggleMic: () => void;
    onToggleSpeaker: () => void;
    onToggleCam: () => void;
    onAudioDeviceChange: (deviceId: string) => void;
    onAudioOutputDeviceChange?: (deviceId: string) => void;
    onVideoDeviceChange: (deviceId: string) => void;
    onPublicChange?: (value: boolean) => void;
    onJoin: () => void;
  };

  let {
    slug,
    roomTitle,
    hostName,
    participantCount,
    maxParticipants,
    isGuest,
    isHost,
    isPublic,
    waitingRoomEnabled = false,
    isStale = false,
    guestName,
    userDisplayName = null,
    micEnabled,
    speakerEnabled,
    camEnabled,
    permissionState,
    previewStream,
    devices,
    audioDeviceId,
    audioOutputDeviceId = "",
    videoDeviceId,
    showAudioOutput = false,
    joining,
    canJoin,
    micTestActive = $bindable(false),
    micGateProcessor = null,
    updatingVisibility = false,
    onGuestNameChange,
    onToggleMic,
    onToggleSpeaker,
    onToggleCam,
    onAudioDeviceChange,
    onAudioOutputDeviceChange,
    onVideoDeviceChange,
    onPublicChange,
    onJoin,
  }: Props = $props();

  let previewEl = $state<HTMLVideoElement | null>(null);
  let micPreviewControls = $state<MicPreviewControls | null>(null);

  async function handleAudioOutputDeviceChange(deviceId: string) {
    onAudioOutputDeviceChange?.(deviceId);
    await micPreviewControls?.applyAudioOutputDevice(deviceId);
  }

  $effect(() => {
    if (previewEl && previewStream) {
      previewEl.srcObject = previewStream;
      syncPreviewTracks(previewStream, { audio: micEnabled, video: camEnabled });
    }
  });
</script>

<Card>
  <CardHeader class="space-y-3">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <CardTitle>Preview and Settings</CardTitle>
      {#if isStale}
        <Badge variant="secondary">Idle</Badge>
      {/if}
    </div>

    {#if isStale}
      <p class="rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm text-muted-foreground">
        This room is idle. Join to wake it up and start a new session.
      </p>
    {/if}
  </CardHeader>

  <CardContent class="space-y-5 pt-4">
    <div class="rounded-lg border border-border bg-secondary/40 px-3 py-2">
      <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <p>
          <span class="text-muted-foreground">Host</span>
          <span class="ms-1.5 font-medium text-foreground">{hostName}</span>
        </p>
        <p>
          <span class="text-muted-foreground">Joined</span>
          <span class="ms-1.5 font-medium text-foreground">{participantCount}/{maxParticipants}</span>
        </p>
        <p class="flex items-center gap-1.5 font-mono font-medium text-foreground">
          <HashIcon class="size-3 text-muted-foreground" aria-hidden="true" />
          {slug}
        </p>
      </div>

      {#if isHost && onPublicChange}
        <Separator class="my-2" />
        <SettingToggle
          id="lobby-public"
          class="py-0"
          label="Public"
          tooltip="Listed on the home page so anyone can join without a room code."
          checked={isPublic}
          disabled={updatingVisibility}
          onCheckedChange={onPublicChange}
        />
      {/if}
    </div>

    {#if isGuest}
      <div class="space-y-2">
        <Label for="guest-name">Your name</Label>
        <Input id="guest-name" value={guestName} oninput={(e) => onGuestNameChange(e.currentTarget.value)} placeholder="Marco" maxlength={40} />
      </div>
    {/if}

    <div class="flex flex-col gap-4 sm:flex-row sm:items-start">
      <div class="min-w-0 flex-1 space-y-3">
        <div class="relative aspect-video max-w-md overflow-hidden rounded-lg bg-secondary">
          {#if camEnabled && previewStream && permissionState === "granted"}
            <video bind:this={previewEl} class="size-full object-cover mirror" autoplay playsinline muted></video>
          {:else}
            <div class="flex size-full items-center justify-center px-4 text-center text-sm text-muted-foreground">
              {#if permissionState === "denied"}
                Camera blocked — check browser site settings for this page.
              {:else if !camEnabled}
                Camera is off
              {:else}
                Allow camera access when prompted, or join with devices off.
              {/if}
            </div>
          {/if}
        </div>

        {#if permissionState === "denied"}
          <p class="text-xs text-muted-foreground">You can still join without devices.</p>
        {/if}
      </div>

      <div class="flex min-w-0 w-full flex-col gap-2 sm:w-52 sm:shrink-0 lg:w-56">
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
          onAudioOutputDeviceChange={handleAudioOutputDeviceChange}
          {onVideoDeviceChange}
          deviceSelectDisabled={permissionState !== "granted"}
        />

        <MicPreviewControls
          bind:this={micPreviewControls}
          layout="stack"
          bind:micTestActive
          {previewStream}
          {micEnabled}
          {speakerEnabled}
          {audioOutputDeviceId}
          {micGateProcessor}
          permissionGranted={permissionState === "granted"}
        />
      </div>
    </div>

    <Button class="w-full sm:w-auto" disabled={joining || !canJoin || micTestActive} onclick={onJoin}>
      {#if joining}
        Joining…
      {:else if isStale}
        Join and wake room
      {:else if waitingRoomEnabled}
        Knock Knock →
      {:else}
        Enter →
      {/if}
    </Button>
  </CardContent>
</Card>

<style>
  .mirror {
    transform: scaleX(-1);
  }
</style>
