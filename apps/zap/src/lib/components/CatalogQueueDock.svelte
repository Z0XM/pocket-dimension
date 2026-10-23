<script lang="ts">
  import ListMusicIcon from "@lucide/svelte/icons/list-music";
  import MonitorSpeakerIcon from "@lucide/svelte/icons/monitor-speaker";
  import { onMount, untrack } from "svelte";
  import { page } from "$app/state";
  import CatalogDevicesPanel from "$lib/components/CatalogDevicesPanel.svelte";
  import CatalogQueueDockBar from "$lib/components/CatalogQueueDockBar.svelte";
  import CatalogQueuePanel from "$lib/components/CatalogQueuePanel.svelte";
  import FloatingPanel from "$lib/components/FloatingPanel.svelte";
  import type { CatalogQueueItem, CatalogQueueState } from "$lib/catalog-queue";
  import type { CatalogQueueClient } from "$lib/catalog-queue-client.svelte";
  import type { FloatingMode } from "$lib/floating-panel";

  let { queue }: { queue: CatalogQueueClient } = $props();

  const DOCK_KEY = "zap.queue.docked";
  const FLOAT_KEY = "zap.float.queue";

  let audioEl = $state<HTMLAudioElement | null>(null);
  let audioBlocked = $state(false);
  let appliedKey = "";
  let pendingSeekSec: number | null = null;
  let docked = $state(false);
  /** When true, exiting fullscreen restores the footer dock instead of a floating panel/icon. */
  let restoreDockOnExitFull = $state(false);
  let floatOpenAs = $state<FloatingMode | null>(null);
  let floatEpoch = $state(0);

  /** Session / join routes own their chrome; hide catalog floating queue + devices there. */
  const path = $derived(page.url.pathname);
  const hideCatalogFloats = $derived(path.startsWith("/session") || path.startsWith("/join"));
  const deviceOutput = $derived(queue.thisDevice?.outputEnabled ?? false);
  const outputHere = $derived(deviceOutput && !hideCatalogFloats);
  const showQueue = $derived(queue.active && !hideCatalogFloats);
  const showDevices = $derived(!hideCatalogFloats && (queue.active || queue.onlineDevices.length > 1));
  const localNote = $derived(!queue.thisDevice ? null : !deviceOutput ? "This device is remote-only." : null);

  function readDocked(): boolean {
    try {
      return localStorage.getItem(DOCK_KEY) === "1";
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

  /** Prefer icon/panel/full when remounting the float after undock / maximize. */
  function writeFloatMode(mode: FloatingMode) {
    try {
      const raw = localStorage.getItem(FLOAT_KEY);
      const base = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      localStorage.setItem(FLOAT_KEY, JSON.stringify({ ...base, mode }));
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
    writeFloatMode("icon");
    floatOpenAs = "icon";
    floatEpoch++;
    setDocked(false);
  }

  function maximizeFromDock() {
    restoreDockOnExitFull = true;
    writeFloatMode("full");
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

  onMount(() => {
    docked = readDocked();
    queue.connect();
    return () => queue.disconnect();
  });

  function silence(el: HTMLAudioElement) {
    if (el.dataset.itemId || el.getAttribute("src")) {
      el.pause();
      el.removeAttribute("src");
      el.load();
    }
    delete el.dataset.itemId;
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
      el.src = `/api/media/${item.mediaAssetId}/audio`;
      el.dataset.itemId = item.id;
      el.load();
    }
    // A new generation means the server moved the playhead (seek / track change); follow it, not our element.
    queue.localPositionMs = null;
    const target = untrack(() => queue.positionMs) / 1000;
    if (el.readyState >= 1) {
      if (Math.abs(el.currentTime - target) > 1) el.currentTime = target;
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
    const key = `${state?.id}|${state?.playbackGeneration}|${state?.playbackState}|${item?.id}|${output}`;
    if (key === appliedKey) return;
    appliedKey = key;
    untrack(() => void apply(el, state, item, output));
  });

  function onLoadedMetadata() {
    if (!audioEl || pendingSeekSec == null) return;
    audioEl.currentTime = pendingSeekSec;
    pendingSeekSec = null;
  }

  function onTimeUpdate() {
    if (!audioEl || !outputHere || audioEl.dataset.itemId !== queue.currentItem?.id) return;
    queue.localPositionMs = Math.round(audioEl.currentTime * 1000);
  }

  function onEnded() {
    const state = queue.queue;
    const itemId = audioEl?.dataset.itemId;
    if (!state || !itemId || itemId !== state.currentItemId) return;
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

{#if showDevices}
  <FloatingPanel id="devices" title="Devices" slot={1} active={queue.onlineDevices.length > 1} badge={queue.onlineDevices.length}>
    {#snippet icon()}
      <MonitorSpeakerIcon class="size-5" />
    {/snippet}
    {#snippet children()}
      <CatalogDevicesPanel {queue} />
    {/snippet}
  </FloatingPanel>
{/if}

{#if queue.notice}
  <div
    class={`pointer-events-none fixed left-1/2 z-50 -translate-x-1/2 rounded border border-signal/40 bg-popover/95 px-3 py-1.5 font-mono text-[11px] text-signal shadow-lg ${
      showQueue && docked ? "bottom-[5.25rem]" : "bottom-4"
    }`}
    role="status"
  >
    {queue.notice}
  </div>
{/if}
