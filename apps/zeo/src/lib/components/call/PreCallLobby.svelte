<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import type { PermissionState } from "$lib/livekit/types";
  import { syncPreviewTracks } from "$lib/livekit/media-preview";

  type Props = {
    roomTitle: string;
    hostName: string;
    participantCount: number;
    maxParticipants: number;
    isGuest: boolean;
    guestName: string;
    userDisplayName?: string | null;
    micEnabled: boolean;
    camEnabled: boolean;
    permissionState: PermissionState;
    previewStream: MediaStream | null;
    joining: boolean;
    canJoin: boolean;
    onGuestNameChange: (value: string) => void;
    onToggleMic: () => void;
    onToggleCam: () => void;
    onJoin: () => void;
  };

  let {
    roomTitle,
    hostName,
    participantCount,
    maxParticipants,
    isGuest,
    guestName,
    userDisplayName = null,
    micEnabled,
    camEnabled,
    permissionState,
    previewStream,
    joining,
    canJoin,
    onGuestNameChange,
    onToggleMic,
    onToggleCam,
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

<section class="rounded-xl border border-border bg-card/60 px-6 py-6 space-y-5">
  <div>
    <h2 class="text-lg font-semibold text-foreground">{roomTitle}</h2>
    <p class="text-sm text-muted-foreground">Host: {hostName}</p>
    <p class="mt-1 text-sm text-muted-foreground">{participantCount} of {maxParticipants} joined</p>
  </div>

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

  <div class="flex flex-wrap gap-2">
    <button
      type="button"
      class="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary aria-pressed:bg-secondary"
      aria-label={micEnabled ? "Mute microphone" : "Unmute microphone"}
      aria-pressed={micEnabled}
      onclick={onToggleMic}
    >
      {micEnabled ? "Mic on" : "Mic off"}
    </button>
    <button
      type="button"
      class="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary aria-pressed:bg-secondary"
      aria-label={camEnabled ? "Turn camera off" : "Turn camera on"}
      aria-pressed={camEnabled}
      onclick={onToggleCam}
    >
      {camEnabled ? "Camera on" : "Camera off"}
    </button>
  </div>

  <Button disabled={joining || !canJoin} onclick={onJoin}>
    {joining ? "Joining…" : "Join call"}
  </Button>
</section>

<style>
  .mirror {
    transform: scaleX(-1);
  }
</style>
