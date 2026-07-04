<script lang="ts">
  import CameraIcon from "@lucide/svelte/icons/camera";
  import MessageSquareIcon from "@lucide/svelte/icons/message-square";
  import MicIcon from "@lucide/svelte/icons/mic";
  import MicOffIcon from "@lucide/svelte/icons/mic-off";
  import MonitorUpIcon from "@lucide/svelte/icons/monitor-up";
  import PhoneOffIcon from "@lucide/svelte/icons/phone-off";
  import SettingsIcon from "@lucide/svelte/icons/settings";
  import SquareIcon from "@lucide/svelte/icons/square";
  import VideoIcon from "@lucide/svelte/icons/video";
  import VideoOffIcon from "@lucide/svelte/icons/video-off";
  import Volume2Icon from "@lucide/svelte/icons/volume-2";
  import VolumeOffIcon from "@lucide/svelte/icons/volume-off";
  import type { StageTileEntry } from "$lib/call/stage-tiles";
  import { displayNameForParticipant } from "$lib/livekit/screen-share";
  import type { ParticipantColor } from "$lib/participant-colors";
  import { IconControlButton } from "$lib/components/ui/icon-control-button";
  import { Tooltip, TooltipContent, TooltipTrigger } from "$lib/components/ui/tooltip";
  import MinimizedStageTile from "./MinimizedStageTile.svelte";

  type Props = {
    isHost: boolean;
    micEnabled: boolean;
    micTesting?: boolean;
    speakerEnabled?: boolean;
    camEnabled: boolean;
    screenSharing?: boolean;
    snapshotting?: boolean;
    chatOpen?: boolean;
    onToggleMic: () => void;
    onToggleSpeaker?: () => void;
    onToggleCam: () => void;
    onToggleScreenShare?: () => void;
    onSnapshot?: () => void;
    onToggleChat?: () => void;
    onToggleDevices?: () => void;
    devicesOpen?: boolean;
    onLeave: () => void;
    onEndRoom?: () => void;
    ending?: boolean;
    barRef?: HTMLElement | null;
    minimizedTiles?: StageTileEntry[];
    hiddenVideoTileKeys?: string[];
    hideParticipantVideos?: boolean;
    localIdentity?: string;
    localDisplayName?: string;
    localTileColor?: ParticipantColor | null;
    onRestoreTile?: (key: string) => void;
  };

  let {
    isHost,
    micEnabled,
    micTesting = false,
    speakerEnabled = true,
    camEnabled,
    screenSharing = false,
    snapshotting = false,
    chatOpen = false,
    onToggleMic,
    onToggleSpeaker,
    onToggleCam,
    onToggleScreenShare,
    onSnapshot,
    onToggleChat,
    onToggleDevices,
    devicesOpen = false,
    onLeave,
    onEndRoom,
    ending = false,
    barRef = $bindable(null),
    minimizedTiles = [],
    hiddenVideoTileKeys = [],
    hideParticipantVideos = false,
    localIdentity = "",
    localDisplayName = "",
    localTileColor = null,
    onRestoreTile,
  }: Props = $props();

  const micLabel = $derived(micTesting ? "Stop mic test and unmute" : micEnabled ? "Mute microphone" : "Unmute microphone");
  const speakerLabel = $derived(speakerEnabled ? "Mute speakers" : "Unmute speakers");
  const camLabel = $derived(camEnabled ? "Turn camera off" : "Turn camera on");
  const shareLabel = $derived(screenSharing ? "Stop sharing screen" : "Share screen");

  function tileDisplayName(tile: StageTileEntry) {
    return displayNameForParticipant(tile.participant, localIdentity, localDisplayName);
  }
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

<div bind:this={barRef} class="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center p-4 pb-6" aria-live="polite">
  <div
    class="pointer-events-auto flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-2xl border border-border bg-card/95 px-3 py-2.5 shadow-lg backdrop-blur-sm"
  >
    {#if minimizedTiles.length > 0}
      <div class="flex max-w-[40vw] items-center gap-1.5 overflow-x-auto border-r border-border pr-2">
        {#each minimizedTiles as tile (tile.key)}
          <Tooltip>
            <TooltipTrigger>
              <button
                type="button"
                class="shrink-0 rounded-md transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Restore {tile.kind === 'screen-share' ? `${tileDisplayName(tile)}'s screen` : tileDisplayName(tile)}"
                onclick={() => onRestoreTile?.(tile.key)}
              >
                <MinimizedStageTile
                  kind={tile.kind}
                  participant={tile.participant}
                  displayName={tileDisplayName(tile)}
                  {localIdentity}
                  {localTileColor}
                  videoHidden={hiddenVideoTileKeys.includes(tile.key)}
                  {hideParticipantVideos}
                />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              Restore {tile.kind === "screen-share" ? `${tileDisplayName(tile)}'s screen` : tileDisplayName(tile)}
            </TooltipContent>
          </Tooltip>
        {/each}
      </div>
    {/if}

    <div class="flex flex-wrap items-center justify-center gap-1.5">
      <IconControlButton label={micLabel} active={micEnabled} onclick={onToggleMic}>
        {#if micEnabled}
          <MicIcon class="size-4 text-participant-orange" />
        {:else}
          <MicOffIcon class="size-4 text-muted-foreground" />
        {/if}
      </IconControlButton>

      {#if onToggleSpeaker}
        <IconControlButton label={speakerLabel} active={speakerEnabled} onclick={onToggleSpeaker}>
          {#if speakerEnabled}
            <Volume2Icon class="size-4 text-participant-orange" />
          {:else}
            <VolumeOffIcon class="size-4 text-muted-foreground" />
          {/if}
        </IconControlButton>
      {/if}

      <IconControlButton label={camLabel} active={camEnabled} onclick={onToggleCam}>
        {#if camEnabled}
          <VideoIcon class="size-4 text-participant-orange" />
        {:else}
          <VideoOffIcon class="size-4 text-muted-foreground" />
        {/if}
      </IconControlButton>

      {#if onToggleScreenShare}
        <IconControlButton label={shareLabel} active={screenSharing} onclick={onToggleScreenShare}>
          <MonitorUpIcon class="size-4 {screenSharing ? 'text-participant-orange' : 'text-muted-foreground'}" />
        </IconControlButton>
      {/if}

      {#if onSnapshot}
        <IconControlButton label={snapshotting ? "Saving snapshot…" : "Capture snapshot"} disabled={snapshotting} onclick={onSnapshot}>
          <CameraIcon class="size-4 text-participant-orange" />
        </IconControlButton>
      {/if}

      {#if onToggleChat}
        <IconControlButton label={chatOpen ? "Close chat" : "Open chat"} active={chatOpen} onclick={onToggleChat}>
          <MessageSquareIcon class="size-4 {chatOpen ? 'text-participant-orange' : 'text-muted-foreground'}" />
        </IconControlButton>
      {/if}

      {#if onToggleDevices}
        <IconControlButton label={devicesOpen ? "Close settings" : "Settings"} active={devicesOpen} onclick={onToggleDevices}>
          <SettingsIcon class="size-4 {devicesOpen ? 'text-participant-orange' : 'text-muted-foreground'}" />
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
</div>
