<script lang="ts">
  import ListMusicIcon from "@lucide/svelte/icons/list-music";
  import MonitorSpeakerIcon from "@lucide/svelte/icons/monitor-speaker";
  import { onMount, untrack } from "svelte";
  import { page } from "$app/state";
  import CatalogDevicesPanel from "$lib/components/CatalogDevicesPanel.svelte";
  import CatalogQueuePanel from "$lib/components/CatalogQueuePanel.svelte";
  import FloatingPanel from "$lib/components/FloatingPanel.svelte";
  import type { CatalogQueueItem, CatalogQueueState } from "$lib/catalog-queue";
  import type { CatalogQueueClient } from "$lib/catalog-queue-client.svelte";

  let { queue }: { queue: CatalogQueueClient } = $props();

  let audioEl = $state<HTMLAudioElement | null>(null);
  let audioBlocked = $state(false);
  let appliedKey = "";
  let pendingSeekSec: number | null = null;
  let lastInterruptSeekGen = -1;

  /** Session / join routes own their chrome; hide catalog floating queue + devices there. */
  const path = $derived(page.url.pathname);
  const hideCatalogFloats = $derived(path.startsWith("/session") || path.startsWith("/join"));
  const deviceOutput = $derived(queue.thisDevice?.outputEnabled ?? false);
  const outputHere = $derived(deviceOutput && !hideCatalogFloats);
  const showQueue = $derived((queue.active || queue.interrupting) && !hideCatalogFloats);
  const showDevices = $derived(!hideCatalogFloats && (queue.active || queue.onlineDevices.length > 1 || queue.interrupting));
  const localNote = $derived(
    !queue.thisDevice
      ? null
      : !deviceOutput
        ? "This device is remote-only."
        : queue.interrupting
          ? queue.interruptPaused
            ? "Catalogue song paused — queue stays paused until you resume the queue or the song ends."
            : "Playing a catalogue song — queue resumes when it ends."
          : null
  );

  onMount(() => {
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
    delete el.dataset.interrupt;
    queue.localPositionMs = null;
    pendingSeekSec = null;
  }

  async function applyInterrupt(el: HTMLAudioElement, mediaAssetId: string, output: boolean, paused: boolean) {
    if (!output) {
      silence(el);
      audioBlocked = false;
      return;
    }
    const key = `interrupt:${mediaAssetId}`;
    if (el.dataset.itemId !== key) {
      el.src = `/api/media/${mediaAssetId}/audio`;
      el.dataset.itemId = key;
      el.dataset.interrupt = "1";
      el.load();
      const startSec = untrack(() => (queue.localPositionMs ?? 0) / 1000);
      pendingSeekSec = startSec;
    }
    if (paused) {
      el.pause();
      audioBlocked = false;
      return;
    }
    try {
      await el.play();
      audioBlocked = false;
    } catch (err) {
      if (err instanceof DOMException && err.name === "NotAllowedError") audioBlocked = true;
    }
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
      delete el.dataset.interrupt;
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
    const interruptId = queue.interruptMediaAssetId;
    const interruptPaused = queue.interruptPaused;
    const seekGen = queue.interruptSeekGen;
    const state = queue.queue;
    const item = queue.currentItem;
    const output = outputHere;
    if (!el) return;

    if (interruptId) {
      // Apply user seek without reloading the track.
      if (seekGen !== lastInterruptSeekGen && el.dataset.interrupt === "1" && el.dataset.itemId === `interrupt:${interruptId}`) {
        lastInterruptSeekGen = seekGen;
        const sec = untrack(() => (queue.localPositionMs ?? 0) / 1000);
        if (el.readyState >= 1) el.currentTime = sec;
        else pendingSeekSec = sec;
      }

      const key = `interrupt|${interruptId}|${interruptPaused}|${output}`;
      if (key === appliedKey) return;
      appliedKey = key;
      lastInterruptSeekGen = seekGen;
      untrack(() => void applyInterrupt(el, interruptId, output, interruptPaused));
      return;
    }

    lastInterruptSeekGen = -1;
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
    if (!audioEl || !outputHere) return;
    if (queue.interruptMediaAssetId) {
      if (audioEl.dataset.interrupt !== "1") return;
      // Don't overwrite a pending user seek with a stale timeupdate.
      queue.localPositionMs = Math.round(audioEl.currentTime * 1000);
      return;
    }
    if (audioEl.dataset.itemId !== queue.currentItem?.id) return;
    queue.localPositionMs = Math.round(audioEl.currentTime * 1000);
  }

  function onEnded() {
    if (queue.interruptMediaAssetId && audioEl?.dataset.interrupt === "1") {
      // Natural end only — never treat a pause as ended.
      if (queue.interruptPaused) return;
      queue.localPositionMs = null;
      void queue.finishInterrupt();
      return;
    }
    const state = queue.queue;
    const itemId = audioEl?.dataset.itemId;
    if (!state || !itemId || itemId !== state.currentItemId) return;
    queue.localPositionMs = null;
    void queue.ended(itemId, state.playbackGeneration);
  }

  function unlock() {
    if (!audioEl) return;
    appliedKey = "";
    if (queue.interruptMediaAssetId) {
      void applyInterrupt(audioEl, queue.interruptMediaAssetId, outputHere, queue.interruptPaused);
      return;
    }
    void apply(audioEl, queue.queue, queue.currentItem, outputHere);
  }

  async function stopFromDrop() {
    queue.clearInterrupt();
    await queue.stop();
  }
</script>

<audio bind:this={audioEl} preload="auto" class="hidden" onloadedmetadata={onLoadedMetadata} ontimeupdate={onTimeUpdate} onended={onEnded}></audio>

{#if showQueue}
  <FloatingPanel
    id="queue"
    title="Queue"
    slot={0}
    active={queue.playing || queue.interruptPlaying}
    badge={queue.items.length}
    dropLabel="Release to stop the queue"
    ondrop={() => void stopFromDrop()}
  >
    {#snippet icon()}
      <ListMusicIcon class="size-5" />
    {/snippet}
    {#snippet children()}
      <CatalogQueuePanel {queue} {audioBlocked} {localNote} onunlock={unlock} />
    {/snippet}
  </FloatingPanel>
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
    class="pointer-events-none fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded border border-signal/40 bg-popover/95 px-3 py-1.5 font-mono text-[11px] text-signal shadow-lg"
    role="status"
  >
    {queue.notice}
  </div>
{/if}
