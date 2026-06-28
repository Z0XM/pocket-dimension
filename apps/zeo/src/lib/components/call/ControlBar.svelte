<script lang="ts">
  import CameraIcon from "@lucide/svelte/icons/camera";
  import MessageSquareIcon from "@lucide/svelte/icons/message-square";
  import MicIcon from "@lucide/svelte/icons/mic";
  import MicOffIcon from "@lucide/svelte/icons/mic-off";
  import MonitorUpIcon from "@lucide/svelte/icons/monitor-up";
  import PhoneOffIcon from "@lucide/svelte/icons/phone-off";
  import Settings2Icon from "@lucide/svelte/icons/settings-2";
  import SquareIcon from "@lucide/svelte/icons/square";
  import VideoIcon from "@lucide/svelte/icons/video";
  import VideoOffIcon from "@lucide/svelte/icons/video-off";
  import { IconControlButton } from "$lib/components/ui/icon-control-button";

  type Props = {
    isHost: boolean;
    micEnabled: boolean;
    camEnabled: boolean;
    screenSharing?: boolean;
    snapshotting?: boolean;
    chatOpen?: boolean;
    onToggleMic: () => void;
    onToggleCam: () => void;
    onToggleScreenShare?: () => void;
    onSnapshot?: () => void;
    onToggleChat?: () => void;
    onToggleDevices?: () => void;
    devicesOpen?: boolean;
    onLeave: () => void;
    onEndRoom?: () => void;
    ending?: boolean;
  };

  let {
    isHost,
    micEnabled,
    camEnabled,
    screenSharing = false,
    snapshotting = false,
    chatOpen = false,
    onToggleMic,
    onToggleCam,
    onToggleScreenShare,
    onSnapshot,
    onToggleChat,
    onToggleDevices,
    devicesOpen = false,
    onLeave,
    onEndRoom,
    ending = false,
  }: Props = $props();

  const micLabel = $derived(micEnabled ? "Mute microphone" : "Unmute microphone");
  const camLabel = $derived(camEnabled ? "Turn camera off" : "Turn camera on");
  const shareLabel = $derived(screenSharing ? "Stop sharing screen" : "Share screen");
</script>

<svelte:window
  onkeydown={(e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.key === "m" || e.key === "M") {
      e.preventDefault();
      onToggleMic();
    }
    if (e.key === "v" || e.key === "V") {
      e.preventDefault();
      onToggleCam();
    }
  }}
/>

<div class="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center p-4 pb-6" aria-live="polite">
  <div
    class="pointer-events-auto flex flex-wrap items-center justify-center gap-1.5 rounded-2xl border border-border bg-card/95 px-3 py-2.5 shadow-lg backdrop-blur-sm"
  >
    <IconControlButton label={micLabel} active={micEnabled} onclick={onToggleMic}>
      {#if micEnabled}
        <MicIcon class="size-4" />
      {:else}
        <MicOffIcon class="size-4" />
      {/if}
    </IconControlButton>

    <IconControlButton label={camLabel} active={camEnabled} onclick={onToggleCam}>
      {#if camEnabled}
        <VideoIcon class="size-4" />
      {:else}
        <VideoOffIcon class="size-4" />
      {/if}
    </IconControlButton>

    {#if onToggleScreenShare}
      <IconControlButton label={shareLabel} active={screenSharing} variant="accent" onclick={onToggleScreenShare}>
        <MonitorUpIcon class="size-4" />
      </IconControlButton>
    {/if}

    {#if onSnapshot}
      <IconControlButton label={snapshotting ? "Saving snapshot…" : "Capture snapshot"} disabled={snapshotting} onclick={onSnapshot}>
        <CameraIcon class="size-4" />
      </IconControlButton>
    {/if}

    {#if onToggleChat}
      <IconControlButton label={chatOpen ? "Close chat" : "Open chat"} active={chatOpen} variant="accent" onclick={onToggleChat}>
        <MessageSquareIcon class="size-4" />
      </IconControlButton>
    {/if}

    {#if onToggleDevices}
      <IconControlButton label="Choose devices" active={devicesOpen} variant="accent" onclick={onToggleDevices}>
        <Settings2Icon class="size-4" />
      </IconControlButton>
    {/if}

    <div class="mx-1 hidden h-6 w-px bg-border sm:block" aria-hidden="true"></div>

    <IconControlButton label="Leave call" variant="destructive" onclick={onLeave}>
      <PhoneOffIcon class="size-4" />
    </IconControlButton>

    {#if isHost && onEndRoom}
      <IconControlButton label={ending ? "Ending room…" : "End room for everyone"} disabled={ending} variant="destructive" onclick={onEndRoom}>
        <SquareIcon class="size-4" />
      </IconControlButton>
    {/if}
  </div>
</div>
