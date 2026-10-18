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

  /** Session pages play their own audio; keep the personal queue silent here so the two never overlap. */
  const onSessionPage = $derived(page.url.pathname.startsWith("/session/"));
  const deviceOutput = $derived(queue.thisDevice?.outputEnabled ?? false);
  const outputHere = $derived(deviceOutput && !onSessionPage);
  const showDevices = $derived(queue.active || queue.onlineDevices.length > 1);
  const localNote = $derived(
    !queue.thisDevice
      ? null
      : onSessionPage && deviceOutput
        ? "Muted here while a session page is open."
        : !deviceOutput
          ? "This device is remote-only."
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
      delete el.dataset.itemId;
    }
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

  async function stopFromDrop() {
    await queue.stop();
  }
</script>

<audio bind:this={audioEl} preload="auto" class="hidden" onloadedmetadata={onLoadedMetadata} ontimeupdate={onTimeUpdate} onended={onEnded}></audio>

{#if queue.active}
  <FloatingPanel
    id="queue"
    title="Queue"
    slot={0}
    active={queue.playing}
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
