<script lang="ts">
  import HashIcon from "@lucide/svelte/icons/hash";
  import LinkIcon from "@lucide/svelte/icons/link";
  import MicIcon from "@lucide/svelte/icons/mic";
  import MicOffIcon from "@lucide/svelte/icons/mic-off";
  import VideoIcon from "@lucide/svelte/icons/video";
  import VideoOffIcon from "@lucide/svelte/icons/video-off";
  import VideoIconRoom from "@lucide/svelte/icons/video";
  import { Badge } from "$lib/components/ui/badge";
  import { Button } from "$lib/components/ui/button";
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "$lib/components/ui/card";
  import { IconControlButton } from "$lib/components/ui/icon-control-button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { Separator } from "$lib/components/ui/separator";
  import { SettingToggle } from "$lib/components/ui/setting-toggle";
  import DevicePicker from "$lib/components/call/DevicePicker.svelte";
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
    isStale?: boolean;
    guestName: string;
    userDisplayName?: string | null;
    micEnabled: boolean;
    camEnabled: boolean;
    permissionState: PermissionState;
    previewStream: MediaStream | null;
    devices: MediaDeviceLists;
    audioDeviceId: string;
    videoDeviceId: string;
    joining: boolean;
    canJoin: boolean;
    updatingVisibility?: boolean;
    onGuestNameChange: (value: string) => void;
    onToggleMic: () => void;
    onToggleCam: () => void;
    onAudioDeviceChange: (deviceId: string) => void;
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
    isStale = false,
    guestName,
    userDisplayName = null,
    micEnabled,
    camEnabled,
    permissionState,
    previewStream,
    devices,
    audioDeviceId,
    videoDeviceId,
    joining,
    canJoin,
    updatingVisibility = false,
    onGuestNameChange,
    onToggleMic,
    onToggleCam,
    onAudioDeviceChange,
    onVideoDeviceChange,
    onPublicChange,
    onJoin,
  }: Props = $props();

  let previewEl = $state<HTMLVideoElement | null>(null);

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
      <div class="space-y-1">
        <CardTitle>{roomTitle}</CardTitle>
        <CardDescription>Host: {hostName}</CardDescription>
        <CardDescription>{participantCount} of {maxParticipants} joined</CardDescription>
      </div>
      <div class="flex flex-wrap gap-2">
        {#if isStale}
          <Badge variant="secondary">Idle</Badge>
        {/if}
        <Badge variant={isPublic ? "default" : "outline"}>{isPublic ? "Public" : "Private"}</Badge>
      </div>
    </div>

    {#if isStale}
      <p class="rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm text-muted-foreground">
        This room is idle. Join to wake it up and start a new session.
      </p>
    {/if}
  </CardHeader>

  <CardContent class="space-y-5 pt-0">
    <div class="rounded-lg border border-border bg-secondary/40 px-4 py-3">
      <div class="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <HashIcon class="size-3.5" />
        Room code
      </div>
      <p class="mt-1 font-mono text-lg text-foreground">{slug}</p>
    </div>

    {#if isHost && onPublicChange}
      <div class="rounded-lg border border-border px-4">
        <SettingToggle
          id="lobby-public"
          label="Public"
          tooltip="Listed on the home page so anyone can join without a room code."
          checked={isPublic}
          disabled={updatingVisibility}
          onCheckedChange={onPublicChange}
        />
      </div>
    {/if}

    {#if isGuest}
      <div class="space-y-2">
        <Label for="guest-name">Your name</Label>
        <Input id="guest-name" value={guestName} oninput={(e) => onGuestNameChange(e.currentTarget.value)} placeholder="Marco" maxlength={40} />
      </div>
    {:else if userDisplayName}
      <p class="text-sm text-muted-foreground">Joining as {userDisplayName}</p>
    {/if}

    <div class="space-y-3">
      <Label>Preview</Label>
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

    {#if permissionState === "granted"}
      <DevicePicker {devices} {audioDeviceId} {videoDeviceId} {onAudioDeviceChange} {onVideoDeviceChange} />
    {/if}

    <div class="flex gap-2">
      <IconControlButton label={micEnabled ? "Mute microphone" : "Unmute microphone"} active={micEnabled} onclick={onToggleMic}>
        {#if micEnabled}
          <MicIcon class="size-4" />
        {:else}
          <MicOffIcon class="size-4" />
        {/if}
      </IconControlButton>
      <IconControlButton label={camEnabled ? "Turn camera off" : "Turn camera on"} active={camEnabled} onclick={onToggleCam}>
        {#if camEnabled}
          <VideoIcon class="size-4" />
        {:else}
          <VideoOffIcon class="size-4" />
        {/if}
      </IconControlButton>
    </div>

    <Button class="w-full sm:w-auto" disabled={joining || !canJoin} onclick={onJoin}>
      {joining ? "Joining…" : isStale ? "Join and wake room" : "Join call"}
    </Button>
  </CardContent>
</Card>

<style>
  .mirror {
    transform: scaleX(-1);
  }
</style>
