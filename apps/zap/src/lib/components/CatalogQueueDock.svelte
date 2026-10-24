<script lang="ts">
  import ListMusicIcon from "@lucide/svelte/icons/list-music";
  import MonitorSpeakerIcon from "@lucide/svelte/icons/monitor-speaker";
  import { onMount, untrack } from "svelte";
  import { page } from "$app/state";
  import CatalogDevicesDock from "$lib/components/CatalogDevicesDock.svelte";
  import CatalogDevicesPanel from "$lib/components/CatalogDevicesPanel.svelte";
  import CatalogQueueDockBar from "$lib/components/CatalogQueueDockBar.svelte";
  import CatalogQueuePanel from "$lib/components/CatalogQueuePanel.svelte";
  import FloatingPanel from "$lib/components/FloatingPanel.svelte";
  import type { CatalogQueueItem, CatalogQueueState } from "$lib/catalog-queue";
  import type { CatalogQueueClient } from "$lib/catalog-queue-client.svelte";
  import { DOCK_BAR_H, type FloatingMode } from "$lib/floating-panel";
  import { registerPlaybackAudio } from "$lib/playback-audio";
  import { subscribeTabAudioLeader } from "$lib/tab-audio-leader";

  let { queue }: { queue: CatalogQueueClient } = $props();

  const DOCK_KEY = "zap.queue.docked";
  const DEVICES_DOCK_KEY = "zap.devices.docked";
  const FLOAT_KEY = "zap.float.queue";
  const DEVICES_FLOAT_KEY = "zap.float.devices";

  let audioEl = $state<HTMLAudioElement | null>(null);
  let audioBlocked = $state(false);
  /** Only one same-browser tab emits sound (shared deviceId); others stay silent followers. */
  let isAudioLeader = $state(false);
  let appliedKey = "";
  let pendingSeekSec: number | null = null;
  let docked = $state(false);
  let devicesDocked = $state(false);
  /** When true, exiting fullscreen restores the footer dock instead of a floating panel/icon. */
  let restoreDockOnExitFull = $state(false);
  let restoreDevicesDockOnExitFull = $state(false);
  let floatOpenAs = $state<FloatingMode | null>(null);
  let floatEpoch = $state(0);
  let devicesFloatOpenAs = $state<FloatingMode | null>(null);
  let devicesFloatEpoch = $state(0);

  /** Session / join routes own their chrome; hide catalog floating queue + devices there. */
  const path = $derived(page.url.pathname);
  const hideCatalogFloats = $derived(path.startsWith("/session") || path.startsWith("/join"));
  const deviceOutput = $derived(queue.thisDevice?.outputEnabled ?? false);
  const outputHere = $derived(deviceOutput && isAudioLeader && !hideCatalogFloats);
  const showQueue = $derived(queue.active && !hideCatalogFloats);
  const showDevices = $derived(!hideCatalogFloats && (queue.active || queue.onlineDevices.length > 1));
  const localNote = $derived(
    !queue.thisDevice
      ? null
      : !deviceOutput
        ? "This device is remote-only."
        : !isAudioLeader
          ? "Audio is playing in another Zap tab."
          : null
  );

  function readFlag(key: string): boolean {
    try {
      return localStorage.getItem(key) === "1";
    } catch {
      return false;
    }
  }

  function setDocked(next: boolean) {
    docked = next;
    try {
      localStorage.setItem(DOCK_KEY, next ? "1" : "0");
    } catch {
      // ignore
    }
  }

  function setDevicesDocked(next: boolean) {
    devicesDocked = next;
    try {
      localStorage.setItem(DEVICES_DOCK_KEY, next ? "1" : "0");
    } catch {
      // ignore
    }
  }

  /** Prefer icon/panel/full when remounting the float after undock / maximize. */
  function writeFloatMode(storageKey: string, mode: FloatingMode) {
    try {
      const raw = localStorage.getItem(storageKey);
      const base = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      localStorage.setItem(storageKey, JSON.stringify({ ...base, mode }));
    } catch {
      // ignore
    }
  }

  function dockQueue() {
    restoreDockOnExitFull = false;
    setDocked(true);
  }

  function undockToMini() {
    restoreDockOnExitFull = false;
    writeFloatMode(FLOAT_KEY, "icon");
    floatOpenAs = "icon";
    floatEpoch++;
    setDocked(false);
  }

  function maximizeFromDock() {
    restoreDockOnExitFull = true;
    writeFloatMode(FLOAT_KEY, "full");
    floatOpenAs = "full";
    floatEpoch++;
    setDocked(false);
  }

  /** FloatingPanel calls this when leaving fullscreen; re-dock if we maximized from the footer. */
  function exitFullFromFloat(): boolean {
    if (!restoreDockOnExitFull) return false;
    restoreDockOnExitFull = false;
    setDocked(true);
    return true;
  }

  function dockDevices() {
    restoreDevicesDockOnExitFull = false;
    setDevicesDocked(true);
  }

  function undockDevicesToMini() {
    restoreDevicesDockOnExitFull = false;
    writeFloatMode(DEVICES_FLOAT_KEY, "icon");
    devicesFloatOpenAs = "icon";
    devicesFloatEpoch++;
    setDevicesDocked(false);
  }

  function maximizeDevicesFromDock() {
    restoreDevicesDockOnExitFull = true;
    writeFloatMode(DEVICES_FLOAT_KEY, "full");
    devicesFloatOpenAs = "full";
    devicesFloatEpoch++;
    setDevicesDocked(false);
  }

  function exitDevicesFullFromFloat(): boolean {
    if (!restoreDevicesDockOnExitFull) return false;
    restoreDevicesDockOnExitFull = false;
    setDevicesDocked(true);
    return true;
  }

  /** Queue footer lifts the Devices corner drop target when both can be visible. */
  const devicesDropInset = $derived(showQueue && docked ? DOCK_BAR_H : 0);

  onMount(() => {
    docked = readFlag(DOCK_KEY);
    devicesDocked = readFlag(DEVICES_DOCK_KEY);
    queue.connect();
    const stopLeader = subscribeTabAudioLeader((leader) => {
      isAudioLeader = leader;
    });
    return () => {
      stopLeader();
      queue.disconnect();
    };
  });

  $effect(() => {
    const el = audioEl;
    if (!el) return;
    return registerPlaybackAudio(el);
  });

  function silence(el: HTMLAudioElement) {
    if (el.dataset.itemId || el.getAttribute("src")) {
      el.pause();
      el.removeAttribute("src");
      el.load();
    }
    delete el.dataset.itemId;
    queue.clearPendingSeek();
    queue.localPositionMs = null;
    pendingSeekSec = null;
  }

  async function apply(el: HTMLAudioElement, state: CatalogQueueState | null, item: CatalogQueueItem | null, output: boolean) {
    if (!output || !state || !item || !item.playable) {
      silence(el);
      audioBlocked = false;
      return;
    }
    if (el.dataset.itemId !== item.id) {
      queue.clearPendingSeek();
      el.src = `/api/media/${item.mediaAssetId}/audio`;
      el.dataset.itemId = item.id;
      el.load();
    }
    // Server moved the playhead (seek / track change). Keep optimistic seek position until
    // timeupdate confirms; otherwise clear local and follow the snapshot estimate.
    const pending = untrack(() => queue.pendingSeekMs);
    const targetMs = pending ?? untrack(() => {
      queue.localPositionMs = null;
      return queue.positionMs;
    });
    const target = targetMs / 1000;
    queue.localPositionMs = targetMs;
    if (el.readyState >= 1) {
      if (Math.abs(el.currentTime - target) > 0.35) el.currentTime = target;
      if (pending != null && Math.abs(el.currentTime * 1000 - pending) <= 750) {
        queue.clearPendingSeek();
      }
    } else {
      pendingSeekSec = target;
    }
    if (state.playbackState === "playing") {
      try {
        await el.play();
        audioBlocked = false;
      } catch (err) {
        if (err instanceof DOMException && err.name === "NotAllowedError") audioBlocked = true;
      }
    } else {
      el.pause();
    }
  }

  $effect(() => {
    const el = audioEl;
    if (!el) return;
    el.volume = Math.min(1, Math.max(0, (queue.thisDevice?.volume ?? 100) / 100));
  });

  $effect(() => {
    const el = audioEl;
    const state = queue.queue;
    const item = queue.currentItem;
    const output = outputHere;
    if (!el) return;
    const key = `${state?.id}|${state?.playbackGeneration}|${state?.playbackState}|${item?.id}|${output}|${isAudioLeader}`;
    if (key === appliedKey) return;
    appliedKey = key;
    untrack(() => void apply(el, state, item, output));
  });

  function onLoadedMetadata() {
    if (!audioEl || pendingSeekSec == null) return;
    audioEl.currentTime = pendingSeekSec;
    pendingSeekSec = null;
    if (queue.pendingSeekMs != null && Math.abs(audioEl.currentTime * 1000 - queue.pendingSeekMs) <= 750) {
      queue.clearPendingSeek();
    }
  }

  function onTimeUpdate() {
    if (!audioEl || !outputHere || audioEl.dataset.itemId !== queue.currentItem?.id) return;
    queue.noteAudioPosition(audioEl.currentTime * 1000);
  }

  function onEnded() {
    const state = queue.queue;
    const itemId = audioEl?.dataset.itemId;
    if (!state || !itemId || itemId !== state.currentItemId) return;
    queue.clearPendingSeek();
    queue.localPositionMs = null;
    void queue.ended(itemId, state.playbackGeneration);
  }

  function unlock() {
    if (!audioEl) return;
    appliedKey = "";
    void apply(audioEl, queue.queue, queue.currentItem, outputHere);
  }
</script>

<audio bind:this={audioEl} preload="auto" class="hidden" onloadedmetadata={onLoadedMetadata} ontimeupdate={onTimeUpdate} onended={onEnded}></audio>

{#if showQueue && docked}
  <CatalogQueueDockBar
    {queue}
    {audioBlocked}
    {localNote}
    onunlock={unlock}
    onmaximize={maximizeFromDock}
    onundock={undockToMini}
  />
{:else if showQueue}
  {#key floatEpoch}
    <FloatingPanel
      id="queue"
      title="Queue"
      slot={0}
      active={queue.playing}
      badge={queue.items.length}
      dropLabel="Release to dock"
      dropTone="dock"
      openAs={floatOpenAs}
      onExitFull={exitFullFromFloat}
      ondrop={dockQueue}
    >
      {#snippet icon()}
        <ListMusicIcon class="size-5" />
      {/snippet}
      {#snippet children()}
        <CatalogQueuePanel {queue} {audioBlocked} {localNote} onunlock={unlock} />
      {/snippet}
    </FloatingPanel>
  {/key}
{/if}

{#if showDevices && devicesDocked}
  <CatalogDevicesDock
    {queue}
    queueDocked={showQueue && docked}
    onmaximize={maximizeDevicesFromDock}
    onundock={undockDevicesToMini}
  />
{:else if showDevices}
  {#key devicesFloatEpoch}
    <FloatingPanel
      id="devices"
      title="Devices"
      slot={1}
      active={queue.onlineDevices.length > 1}
      badge={queue.onlineDevices.length}
      dropLabel="Release to dock"
      dropTone="dock"
      dropAnchor="corner"
      dropBottomInset={devicesDropInset}
      openAs={devicesFloatOpenAs}
      onExitFull={exitDevicesFullFromFloat}
      ondrop={dockDevices}
    >
      {#snippet icon()}
        <MonitorSpeakerIcon class="size-5" />
      {/snippet}
      {#snippet children()}
        <CatalogDevicesPanel {queue} />
      {/snippet}
    </FloatingPanel>
  {/key}
{/if}

