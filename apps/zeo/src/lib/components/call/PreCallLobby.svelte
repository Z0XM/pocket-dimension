<script lang="ts">
  import { Badge } from "$lib/components/ui/badge";
  import { Button } from "$lib/components/ui/button";
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "$lib/components/ui/card";
  import { Checkbox } from "$lib/components/ui/checkbox";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
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
  <CardHeader>
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <CardTitle>{roomTitle}</CardTitle>
        <CardDescription class="mt-1">Host: {hostName}</CardDescription>
        <CardDescription class="mt-1">{participantCount} of {maxParticipants} joined</CardDescription>
      </div>
      <Badge variant={isPublic ? "default" : "outline"}>{isPublic ? "Public" : "Private"}</Badge>
    </div>
  </CardHeader>

  <CardContent class="space-y-5 pt-0">
    <div class="rounded-lg border border-border bg-secondary/40 px-4 py-3">
      <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Room code</p>
      <p class="mt-1 font-mono text-lg text-foreground">{slug}</p>
      <p class="mt-1 text-xs text-muted-foreground">Share this code so others can join the call.</p>
    </div>

    {#if isHost && onPublicChange}
      <label class="flex items-start gap-3 text-sm text-foreground">
        <Checkbox checked={isPublic} disabled={updatingVisibility} onCheckedChange={(value) => onPublicChange(Boolean(value))} class="mt-0.5" />
        <span>Make room public (visible on the home page for anyone to join)</span>
      </label>
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
      <p class="text-sm font-medium text-foreground">Preview</p>
      <div class="relative aspect-video max-w-md overflow-hidden rounded-lg bg-secondary">
        {#if camEnabled && previewStream && permissionState === "granted"}
          <video bind:this={previewEl} class="size-full object-cover mirror" autoplay playsinline muted></video>
        {:else}
          <div class="flex size-full items-center justify-center px-4 text-center text-sm text-muted-foreground">
            {#if permissionState === "denied"}
              Camera blocked — check your browser site settings to allow camera and microphone for this page.
            {:else if !camEnabled}
              Camera is off
            {:else}
              Allow camera access when prompted, or join with devices off.
            {/if}
          </div>
        {/if}
      </div>

      {#if permissionState === "denied"}
        <p class="text-sm text-muted-foreground">
          You can still join audio-only or without devices. Click the lock icon in your browser address bar to re-enable permissions.
        </p>
      {/if}
    </div>

    {#if permissionState === "granted"}
      <DevicePicker {devices} {audioDeviceId} {videoDeviceId} {onAudioDeviceChange} {onVideoDeviceChange} />
    {/if}

    <div class="flex flex-wrap gap-2">
      <Button type="button" variant={micEnabled ? "secondary" : "outline"} aria-pressed={micEnabled} onclick={onToggleMic}>
        {micEnabled ? "Mic on" : "Mic off"}
      </Button>
      <Button type="button" variant={camEnabled ? "secondary" : "outline"} aria-pressed={camEnabled} onclick={onToggleCam}>
        {camEnabled ? "Camera on" : "Camera off"}
      </Button>
    </div>

    <Button disabled={joining || !canJoin} onclick={onJoin}>
      {joining ? "Joining…" : "Join call"}
    </Button>
  </CardContent>
</Card>

<style>
  .mirror {
    transform: scaleX(-1);
  }
</style>
