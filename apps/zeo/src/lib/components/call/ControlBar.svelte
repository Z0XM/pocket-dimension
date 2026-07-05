<script lang="ts">
  import CameraIcon from "@lucide/svelte/icons/camera";
  import EllipsisVerticalIcon from "@lucide/svelte/icons/ellipsis-vertical";
  import MessageSquareIcon from "@lucide/svelte/icons/message-square";
  import MicIcon from "@lucide/svelte/icons/mic";
  import MicOffIcon from "@lucide/svelte/icons/mic-off";
  import MonitorUpIcon from "@lucide/svelte/icons/monitor-up";
  import PhoneOffIcon from "@lucide/svelte/icons/phone-off";
  import SettingsIcon from "@lucide/svelte/icons/settings";
  import LayoutGridIcon from "@lucide/svelte/icons/layout-grid";
  import SquareIcon from "@lucide/svelte/icons/square";
  import VideoIcon from "@lucide/svelte/icons/video";
  import VideoOffIcon from "@lucide/svelte/icons/video-off";
  import Volume2Icon from "@lucide/svelte/icons/volume-2";
  import VolumeOffIcon from "@lucide/svelte/icons/volume-off";
  import { onMount } from "svelte";
  import type { StageTileEntry } from "$lib/call/stage-tiles";
  import { displayNameForParticipant } from "$lib/livekit/screen-share";
  import type { ParticipantColor } from "$lib/participant-colors";
  import { prefersCoarsePointer } from "$lib/pwa";
  import { IconControlButton } from "$lib/components/ui/icon-control-button";
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
    onToggleGridSettings?: () => void;
    gridSettingsOpen?: boolean;
    onLeave: () => void;
    onEndRoom?: () => void;
    ending?: boolean;
    barRef?: HTMLElement | null;
    minimizedTiles?: StageTileEntry[];
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
    onToggleGridSettings,
    gridSettingsOpen = false,
    onLeave,
    onEndRoom,
    ending = false,
    barRef = $bindable(null),
    minimizedTiles = [],
    localIdentity = "",
    localDisplayName = "",
    localTileColor = null,
    onRestoreTile,
  }: Props = $props();

  let compactControls = $state(false);
  let showTooltips = $state(true);
  let showMoreMenu = $state(false);
  let moreMenuRef = $state<HTMLDivElement | null>(null);

  const micLabel = $derived(micTesting ? "Stop mic test and unmute" : micEnabled ? "Mute microphone" : "Unmute microphone");
  const speakerLabel = $derived(speakerEnabled ? "Mute speakers" : "Unmute speakers");
  const camLabel = $derived(camEnabled ? "Turn camera off" : "Turn camera on");
  const shareLabel = $derived(screenSharing ? "Stop sharing screen" : "Share screen");
  const hasOverflowControls = $derived(
    Boolean(onToggleScreenShare || onSnapshot || onToggleChat || onToggleGridSettings || onToggleDevices || (isHost && onEndRoom))
  );

  function tileDisplayName(tile: StageTileEntry) {
    return displayNameForParticipant(tile.participant, localIdentity, localDisplayName);
  }

  function closeMoreMenu() {
    showMoreMenu = false;
  }

  function runOverflowAction(action?: () => void) {
    closeMoreMenu();
    action?.();
  }

  onMount(() => {
    const widthQuery = window.matchMedia("(max-width: 640px)");
    const syncLayout = () => {
      compactControls = widthQuery.matches;
    };
    syncLayout();
    showTooltips = !prefersCoarsePointer();
    widthQuery.addEventListener("change", syncLayout);

    const onPointerDown = (event: PointerEvent) => {
      if (!showMoreMenu || !moreMenuRef) return;
      if (event.target instanceof Node && moreMenuRef.contains(event.target)) return;
      closeMoreMenu();
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      widthQuery.removeEventListener("change", syncLayout);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  });
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
    if ((e.key === "s" || e.key === "S") && onToggleSpeaker) {
      e.preventDefault();
      onToggleSpeaker();
    }
    if ((e.key === "c" || e.key === "C") && onToggleChat) {
      e.preventDefault();
      onToggleChat();
    }
    if ((e.key === "d" || e.key === "D") && onToggleDevices) {
      e.preventDefault();
      onToggleDevices();
    }
    if ((e.key === "g" || e.key === "G") && onToggleGridSettings) {
      e.preventDefault();
      onToggleGridSettings();
    }
  }}
/>

<div
  bind:this={barRef}
  class="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 safe-x"
  aria-live="polite"
>
  <div
    class="pointer-events-auto flex w-full max-w-[calc(100vw-1.5rem)] items-center gap-2 rounded-2xl border border-border bg-card/95 px-2 py-2 shadow-lg backdrop-blur-sm sm:max-w-[calc(100vw-2rem)] sm:px-3 sm:py-2.5 md:w-fit"
  >
    {#if minimizedTiles.length > 0}
      <div class="touch-scroll-x flex max-w-[36vw] shrink-0 items-center gap-1.5 overflow-x-auto border-r border-border pr-2 sm:max-w-[40vw]">
        {#each minimizedTiles as tile (tile.key)}
          <button
            type="button"
            class="shrink-0 rounded-md transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Restore {tile.kind === 'screen-share' ? `${tileDisplayName(tile)}'s screen` : tileDisplayName(tile)}"
            onclick={() => onRestoreTile?.(tile.key)}
          >
            <MinimizedStageTile
              kind={tile.kind}
              participant={tile.participant}
              displayName={tileDisplayName(tile)}
              {localIdentity}
              {localTileColor}
            />
          </button>
        {/each}
      </div>
    {/if}

    <div class="flex min-w-0 flex-1 items-center justify-center gap-1 sm:gap-1.5 md:flex-none">
      <IconControlButton label={micLabel} active={micEnabled} showTooltip={showTooltips} onclick={onToggleMic}>
        {#if micEnabled}
          <MicIcon class="size-4 text-participant-orange" />
        {:else}
          <MicOffIcon class="size-4 text-muted-foreground" />
        {/if}
      </IconControlButton>

      {#if onToggleSpeaker}
        <IconControlButton label={speakerLabel} active={speakerEnabled} showTooltip={showTooltips} onclick={onToggleSpeaker}>
          {#if speakerEnabled}
            <Volume2Icon class="size-4 text-participant-orange" />
          {:else}
            <VolumeOffIcon class="size-4 text-muted-foreground" />
          {/if}
        </IconControlButton>
      {/if}

      <IconControlButton label={camLabel} active={camEnabled} showTooltip={showTooltips} onclick={onToggleCam}>
        {#if camEnabled}
          <VideoIcon class="size-4 text-participant-orange" />
        {:else}
          <VideoOffIcon class="size-4 text-muted-foreground" />
        {/if}
      </IconControlButton>

      {#if compactControls && hasOverflowControls}
        <div bind:this={moreMenuRef} class="relative">
          <IconControlButton
            label="More call controls"
            active={showMoreMenu || screenSharing || chatOpen || devicesOpen || gridSettingsOpen}
            showTooltip={showTooltips}
            onclick={() => (showMoreMenu = !showMoreMenu)}
          >
            <EllipsisVerticalIcon class="size-4 text-muted-foreground" />
          </IconControlButton>

          {#if showMoreMenu}
            <div
              class="absolute bottom-[calc(100%+0.5rem)] left-1/2 z-50 flex -translate-x-1/2 flex-wrap items-center justify-center gap-1 rounded-xl border border-border bg-card p-2 shadow-lg"
              role="menu"
            >
              {#if onToggleScreenShare}
                <IconControlButton
                  label={shareLabel}
                  active={screenSharing}
                  showTooltip={false}
                  onclick={() => runOverflowAction(onToggleScreenShare)}
                >
                  <MonitorUpIcon class="size-4 {screenSharing ? 'text-participant-orange' : 'text-muted-foreground'}" />
                </IconControlButton>
              {/if}
              {#if onSnapshot}
                <IconControlButton
                  label={snapshotting ? "Saving snapshot…" : "Capture snapshot"}
                  disabled={snapshotting}
                  showTooltip={false}
                  onclick={() => runOverflowAction(onSnapshot)}
                >
                  <CameraIcon class="size-4 text-participant-orange" />
                </IconControlButton>
              {/if}
              {#if onToggleChat}
                <IconControlButton
                  label={chatOpen ? "Close chat" : "Open chat"}
                  active={chatOpen}
                  showTooltip={false}
                  onclick={() => runOverflowAction(onToggleChat)}
                >
                  <MessageSquareIcon class="size-4 {chatOpen ? 'text-participant-orange' : 'text-muted-foreground'}" />
                </IconControlButton>
              {/if}
              {#if onToggleGridSettings}
                <IconControlButton
                  label={gridSettingsOpen ? "Close grid settings" : "Grid settings"}
                  active={gridSettingsOpen}
                  showTooltip={false}
                  onclick={() => runOverflowAction(onToggleGridSettings)}
                >
                  <LayoutGridIcon class="size-4 {gridSettingsOpen ? 'text-participant-orange' : 'text-muted-foreground'}" />
                </IconControlButton>
              {/if}
              {#if onToggleDevices}
                <IconControlButton
                  label={devicesOpen ? "Close settings" : "Settings"}
                  active={devicesOpen}
                  showTooltip={false}
                  onclick={() => runOverflowAction(onToggleDevices)}
                >
                  <SettingsIcon class="size-4 {devicesOpen ? 'text-participant-orange' : 'text-muted-foreground'}" />
                </IconControlButton>
              {/if}
              {#if isHost && onEndRoom}
                <IconControlButton
                  label={ending ? "Ending room…" : "End room for everyone"}
                  disabled={ending}
                  variant="destructive"
                  showTooltip={false}
                  onclick={() => runOverflowAction(onEndRoom)}
                >
                  <SquareIcon class="size-4" />
                </IconControlButton>
              {/if}
            </div>
          {/if}
        </div>
      {:else}
        {#if onToggleScreenShare}
          <IconControlButton label={shareLabel} active={screenSharing} showTooltip={showTooltips} onclick={onToggleScreenShare}>
            <MonitorUpIcon class="size-4 {screenSharing ? 'text-participant-orange' : 'text-muted-foreground'}" />
          </IconControlButton>
        {/if}

        {#if onSnapshot}
          <IconControlButton
            label={snapshotting ? "Saving snapshot…" : "Capture snapshot"}
            disabled={snapshotting}
            showTooltip={showTooltips}
            onclick={onSnapshot}
          >
            <CameraIcon class="size-4 text-participant-orange" />
          </IconControlButton>
        {/if}

        {#if onToggleChat}
          <IconControlButton label={chatOpen ? "Close chat" : "Open chat"} active={chatOpen} showTooltip={showTooltips} onclick={onToggleChat}>
            <MessageSquareIcon class="size-4 {chatOpen ? 'text-participant-orange' : 'text-muted-foreground'}" />
          </IconControlButton>
        {/if}

        {#if onToggleGridSettings}
          <IconControlButton
            label={gridSettingsOpen ? "Close grid settings" : "Grid settings"}
            active={gridSettingsOpen}
            showTooltip={showTooltips}
            onclick={onToggleGridSettings}
          >
            <LayoutGridIcon class="size-4 {gridSettingsOpen ? 'text-participant-orange' : 'text-muted-foreground'}" />
          </IconControlButton>
        {/if}

        {#if onToggleDevices}
          <IconControlButton
            label={devicesOpen ? "Close settings" : "Settings"}
            active={devicesOpen}
            showTooltip={showTooltips}
            onclick={onToggleDevices}
          >
            <SettingsIcon class="size-4 {devicesOpen ? 'text-participant-orange' : 'text-muted-foreground'}" />
          </IconControlButton>
        {/if}

        <div class="mx-1 hidden h-6 w-px bg-border sm:block" aria-hidden="true"></div>

        {#if isHost && onEndRoom}
          <IconControlButton
            label={ending ? "Ending room…" : "End room for everyone"}
            disabled={ending}
            variant="destructive"
            showTooltip={showTooltips}
            onclick={onEndRoom}
          >
            <SquareIcon class="size-4" />
          </IconControlButton>
        {/if}
      {/if}

      <IconControlButton label="Leave call" variant="destructive" showTooltip={showTooltips} onclick={onLeave}>
        <PhoneOffIcon class="size-4" />
      </IconControlButton>
    </div>
  </div>
</div>
