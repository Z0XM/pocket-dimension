import { getContext, setContext } from "svelte";
  import {
    estimatePositionMs,
    type CatalogDevice,
    type CatalogQueueItem,
    type CatalogQueueRunTrack,
    type CatalogQueueSnapshot,
    type EnqueueMode,
  } from "$lib/catalog-queue";

const CONTEXT_KEY = Symbol("zap-catalog-queue");
const DEVICE_STORAGE_KEY = "zap.deviceId";

export type CatalogueFilterInput = {
  scope: "all" | "yours" | "playlist";
  playlistId?: string | null;
  q?: string;
  tagQuery?: string;
  tagIds?: string[];
};

type CommandResult = (CatalogQueueSnapshot & { notice?: string }) | null;

function readDeviceId(): string {
  try {
    const stored = localStorage.getItem(DEVICE_STORAGE_KEY);
    if (stored && /^[A-Za-z0-9-]{8,64}$/.test(stored)) return stored;
    const next = crypto.randomUUID();
    localStorage.setItem(DEVICE_STORAGE_KEY, next);
    return next;
  } catch {
    return crypto.randomUUID();
  }
}

/** Browser-side mirror of the user's catalogue queue: SSE snapshots in, JSON commands out. */
export class CatalogQueueClient {
  snapshot = $state<CatalogQueueSnapshot | null>(null);
  deviceId = $state("");
  connected = $state(false);
  error = $state<string | null>(null);
  notice = $state<string | null>(null);
  pending = $state(0);
  now = $state(Date.now());
  /** Playhead from this device's audio element while it is the one producing sound. */
  localPositionMs = $state<number | null>(null);
  /**
   * Catalogue one-shot: pause the personal queue, play this media, then resume.
   * Not part of the queue snapshot — local to this device.
   */
  interruptMediaAssetId = $state<string | null>(null);
  interruptTitle = $state<string | null>(null);

  queue = $derived(this.snapshot?.queue ?? null);
  items = $derived<CatalogQueueItem[]>(this.snapshot?.items ?? []);
  devices = $derived<CatalogDevice[]>(this.snapshot?.devices ?? []);
  onlineDevices = $derived(this.devices.filter((d) => d.online));
  thisDevice = $derived(this.devices.find((d) => d.deviceId === this.deviceId) ?? null);
  currentItem = $derived(this.items.find((i) => i.id === this.queue?.currentItemId) ?? null);
  currentIndex = $derived(this.items.findIndex((i) => i.id === this.queue?.currentItemId));
  active = $derived(Boolean(this.queue) && this.items.length > 0);
  playing = $derived(this.queue?.playbackState === "playing" && Boolean(this.currentItem) && !this.interruptMediaAssetId);
  interrupting = $derived(Boolean(this.interruptMediaAssetId));
  /** True when replacing the personal queue would discard an in-progress run. */
  needsReplaceConfirm = $derived(this.active);
  positionMs = $derived.by(() => {
    if (this.interruptMediaAssetId) return this.localPositionMs ?? 0;
    if (this.localPositionMs != null) return this.localPositionMs;
    if (!this.queue) return 0;
    return estimatePositionMs(this.queue, this.now + this.clockOffsetMs, this.currentItem?.durationMs);
  });

  private clockOffsetMs = 0;
  private lastSeq = -1;
  private es: EventSource | null = null;
  private ticker: ReturnType<typeof setInterval> | null = null;
  private noticeTimer: ReturnType<typeof setTimeout> | null = null;
  private interruptResumePlaying = false;

  connect() {
    if (this.es) return;
    this.deviceId = readDeviceId();
    const es = new EventSource(`/api/catalog-queue/events?deviceId=${encodeURIComponent(this.deviceId)}`);
    es.addEventListener("open", () => {
      this.connected = true;
      // Sequence numbers are per server process; accept the next snapshot after any reconnect.
      this.lastSeq = -1;
    });
    es.addEventListener("snapshot", (ev) => {
      try {
        this.apply(JSON.parse((ev as MessageEvent).data) as CatalogQueueSnapshot);
      } catch {
        // ignore malformed frames
      }
    });
    es.onerror = () => {
      this.connected = false;
    };
    this.es = es;
    this.ticker = setInterval(() => {
      if (this.playing) this.now = Date.now();
    }, 500);
  }

  disconnect() {
    this.es?.close();
    this.es = null;
    if (this.ticker) clearInterval(this.ticker);
    this.ticker = null;
    this.connected = false;
  }

  apply(next: CatalogQueueSnapshot) {
    if (next.seq <= this.lastSeq) return;
    this.lastSeq = next.seq;
    const serverNow = Date.parse(next.serverNow);
    if (Number.isFinite(serverNow)) this.clockOffsetMs = serverNow - Date.now();
    this.now = Date.now();
    this.snapshot = next;
  }

  private flash(message: string) {
    this.notice = message;
    if (this.noticeTimer) clearTimeout(this.noticeTimer);
    this.noticeTimer = setTimeout(() => (this.notice = null), 4000);
  }

  private async send(url: string, init: RequestInit): Promise<CommandResult> {
    this.pending++;
    this.error = null;
    try {
      const res = await fetch(url, {
        credentials: "same-origin",
        ...init,
        headers: { "Content-Type": "application/json", Accept: "application/json", ...(init.headers ?? {}) },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message ?? `Request failed (${res.status})`);
      if (body && typeof body.seq === "number") this.apply(body as CatalogQueueSnapshot);
      if (typeof body?.notice === "string") this.flash(body.notice);
      return body as CommandResult;
    } catch (err) {
      this.error = err instanceof Error ? err.message : "Request failed";
      return null;
    } finally {
      this.pending--;
    }
  }

  private command(body: Record<string, unknown>) {
    return this.send("/api/catalog-queue", { method: "POST", body: JSON.stringify(body) });
  }

  // --- adding -------------------------------------------------------------

  clearInterrupt() {
    this.interruptMediaAssetId = null;
    this.interruptTitle = null;
    this.interruptResumePlaying = false;
    this.localPositionMs = null;
  }

  /**
   * Catalogue row Play: if a personal queue is active, pause it and play this song as a one-shot;
   * when it ends, resume the queue. With no active queue, enqueue+play as usual.
   */
  async playCatalogueSong(mediaAssetId: string, meta?: { title?: string | null }) {
    this.error = null;
    // Same catalogue song while interrupting → stop interrupt and resume queue if it was playing.
    if (this.interruptMediaAssetId === mediaAssetId) {
      await this.finishInterrupt();
      return null;
    }
    if (this.active) {
      const wasPlaying = this.queue?.playbackState === "playing" || Boolean(this.interruptMediaAssetId && this.interruptResumePlaying);
      if (this.queue?.playbackState === "playing") {
        await this.command({ action: "pause", positionMs: this.positionMs });
      }
      this.interruptResumePlaying = wasPlaying;
      this.interruptMediaAssetId = mediaAssetId;
      this.interruptTitle = meta?.title?.trim() || null;
      this.localPositionMs = 0;
      return null;
    }
    this.clearInterrupt();
    return this.command({ action: "enqueue", mediaAssetIds: [mediaAssetId], mode: "play" });
  }

  async finishInterrupt() {
    const resume = this.interruptResumePlaying;
    this.clearInterrupt();
    if (resume && this.active) await this.play();
  }

  /** @deprecated Prefer playCatalogueSong for catalogue rows; kept for History one-offs that should interrupt. */
  playNow(mediaAssetId: string) {
    return this.playCatalogueSong(mediaAssetId);
  }

  async enqueue(mediaAssetIds: string[], mode: EnqueueMode) {
    this.clearInterrupt();
    const res = await this.command({ action: "enqueue", mediaAssetIds, mode });
    if (res && mode !== "play") {
      const label = mode === "next" ? "Playing next" : mode === "queue" ? "Added to queue" : "Added to the end";
      this.flash(mediaAssetIds.length === 1 ? `${label}.` : `${label}: ${mediaAssetIds.length} tracks.`);
    }
    return res;
  }

  enqueueFiltered(filter: CatalogueFilterInput, mode: EnqueueMode | "replace") {
    this.clearInterrupt();
    return this.command({ action: "enqueueFiltered", filter, mode });
  }

  enqueuePlaylist(playlistId: string, mode: EnqueueMode | "replace") {
    this.clearInterrupt();
    return this.command({ action: "enqueuePlaylist", playlistId, mode });
  }

  /** Close the current run (History) and start a fresh queue with these tracks. */
  replaceTracks(mediaAssetIds: string[], opts: { play?: boolean } = {}) {
    this.clearInterrupt();
    return this.command({ action: "replace", mediaAssetIds, play: opts.play !== false });
  }

  // --- transport ----------------------------------------------------------

  play() {
    if (this.interruptMediaAssetId) {
      this.clearInterrupt();
    }
    return this.command({ action: "play" });
  }

  pause() {
    if (this.interruptMediaAssetId) {
      this.clearInterrupt();
      return null;
    }
    return this.command({ action: "pause", positionMs: this.positionMs });
  }

  togglePlay() {
    if (this.interruptMediaAssetId) {
      void this.finishInterrupt();
      return null;
    }
    return this.playing ? this.pause() : this.play();
  }

  seek(positionMs: number) {
    if (this.localPositionMs != null) this.localPositionMs = positionMs;
    return this.command({ action: "seek", positionMs });
  }

  next() {
    return this.command({ action: "next" });
  }

  previous() {
    return this.command({ action: "previous" });
  }

  jump(itemId: string) {
    return this.command({ action: "jump", itemId });
  }

  ended(itemId: string, generation: number) {
    return this.command({ action: "ended", itemId, generation });
  }

  // --- editing ------------------------------------------------------------

  remove(itemId: string) {
    return this.command({ action: "remove", itemId });
  }

  reorder(order: string[]) {
    if (this.snapshot) {
      const byId = new Map(this.snapshot.items.map((i) => [i.id, i]));
      const items = order.map((id) => byId.get(id)).filter((i): i is CatalogQueueItem => Boolean(i));
      if (items.length === this.snapshot.items.length) this.snapshot = { ...this.snapshot, items };
    }
    return this.command({ action: "reorder", order });
  }

  stop() {
    return this.command({ action: "stop" });
  }

  // --- devices ------------------------------------------------------------

  updateDevice(deviceId: string, patch: { outputEnabled?: boolean; volume?: number }) {
    return this.send(`/api/catalog-queue/devices/${encodeURIComponent(deviceId)}`, { method: "PATCH", body: JSON.stringify(patch) });
  }

  forgetDevice(deviceId: string) {
    return this.send(`/api/catalog-queue/devices/${encodeURIComponent(deviceId)}`, { method: "DELETE" });
  }

  // --- history runs -------------------------------------------------------

  async fetchRunTracks(runId: string): Promise<CatalogQueueRunTrack[] | null> {
    this.pending++;
    this.error = null;
    try {
      const res = await fetch(`/api/catalog-queue/runs/${runId}`, {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message ?? "Could not load tracks");
      return Array.isArray(body?.tracks) ? (body.tracks as CatalogQueueRunTrack[]) : [];
    } catch (err) {
      this.error = err instanceof Error ? err.message : "Could not load tracks";
      return null;
    } finally {
      this.pending--;
    }
  }

  activateRun(runId: string, mode: "restart" | "resume") {
    this.clearInterrupt();
    return this.send(`/api/catalog-queue/runs/${runId}`, { method: "POST", body: JSON.stringify({ action: mode }) });
  }

  deleteRun(runId: string) {
    return this.send(`/api/catalog-queue/runs/${runId}`, { method: "DELETE" });
  }

  async saveRunAsPlaylist(runId: string, name: string): Promise<{ id: string; name: string; trackCount: number } | null> {
    this.pending++;
    this.error = null;
    try {
      const res = await fetch(`/api/catalog-queue/runs/${runId}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ action: "savePlaylist", name }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message ?? "Save failed");
      this.flash(`Saved playlist “${body.name}”.`);
      return body;
    } catch (err) {
      this.error = err instanceof Error ? err.message : "Save failed";
      return null;
    } finally {
      this.pending--;
    }
  }
}

export function setCatalogQueue(client: CatalogQueueClient) {
  setContext(CONTEXT_KEY, client);
}

/** Null outside the protected layout (e.g. auth pages). */
export function getCatalogQueue(): CatalogQueueClient | null {
  return getContext<CatalogQueueClient | undefined>(CONTEXT_KEY) ?? null;
}
