<script lang="ts">
  import PauseIcon from "@lucide/svelte/icons/pause";
  import PlayIcon from "@lucide/svelte/icons/play";
  import SkipBackIcon from "@lucide/svelte/icons/skip-back";
  import SkipForwardIcon from "@lucide/svelte/icons/skip-forward";
  import Volume2Icon from "@lucide/svelte/icons/volume-2";
  import ConfirmDialog from "$lib/components/ConfirmDialog.svelte";
  import SeekBar from "$lib/components/SeekBar.svelte";
  import { toast } from "$lib/toast.svelte";
  import { formatClock } from "$lib/catalog-queue";
  import { registerPlaybackAudio } from "$lib/playback-audio";
  import { PLAYHEAD_SEEK_CATCHUP_MS, reconcilePlayhead, serverPlayheadMs } from "$lib/session-playhead";
  import type { SessionSnapshot } from "$lib/server/sessions/types";

  let {
    snapshot = $bindable<SessionSnapshot>(),
    audioEl = $bindable<HTMLAudioElement | null>(null),
  }: {
    snapshot: SessionSnapshot;
    audioEl?: HTMLAudioElement | null;
  } = $props();

  let busy = $state(false);
  let appliedGen = $state(-1);
  let endConfirmOpen = $state(false);
  let scrubMs = $state<number | null>(null);
  /** Optimistic seek until live target catches up. */
  let pendingSeekMs = $state<number | null>(null);
  /** Smoothed UI playhead — advanced locally, reconciled to server/audio. */
  let renderMs = $state(0);
  let lastGen = $state(-1);
  let lastAssetId = $state<string | null>(null);
  let volumeScrub = $state<number | null>(null);
  let volumeBusy = $state(false);

  const session = $derived(snapshot.session);
  const current = $derived(snapshot.currentItem);
  const canPlayPause = $derived(Boolean(snapshot.me?.canPlayPause));
  const canSkip = $derived(Boolean(snapshot.me?.canSkip));
  const canSeek = $derived(Boolean(snapshot.me?.canSeek));
  const canSetup = $derived(Boolean(snapshot.me?.canSetup));
  const canEnd = $derived(snapshot.me?.role === "host");
  const myMember = $derived(snapshot.members.find((m) => m.userId === snapshot.me?.userId) ?? null);
  const outputEnabled = $derived(myMember?.outputEnabled ?? true);
  const memberVolume = $derived(myMember?.volume ?? 100);
  const displayVolume = $derived(volumeScrub ?? memberVolume);
  const durationMs = $derived(current?.durationMs ?? 0);
  const playing = $derived(session?.playbackState === "playing" && Boolean(current));

  function audioPlayheadMs(): number | null {
    const el = audioEl;
    if (!el || !outputEnabled) return null;
    if (el.paused || el.seeking) return null;
    if (el.dataset.assetId !== current?.mediaAssetId) return null;
    if (!Number.isFinite(el.currentTime)) return null;
    return Math.max(0, Math.round(el.currentTime * 1000));
  }

  function authoritativeTargetMs(nowMs: number): number {
    if (pendingSeekMs != null) return pendingSeekMs;
    const fromAudio = audioPlayheadMs();
    if (fromAudio != null) return durationMs > 0 ? Math.min(fromAudio, durationMs) : fromAudio;
    return serverPlayheadMs(session, nowMs, durationMs);
  }

  // Smooth local advance + reconcile to audio/server anchors (SSE can be sparse).
  $effect(() => {
    const gen = session?.playbackGeneration ?? -1;
    const assetId = current?.mediaAssetId ?? null;
    const isPlaying = playing;
    // Re-run when server anchor fields change so we can soft-correct.
    void session?.positionMs;
    void session?.positionUpdatedAt;
    void session?.playbackState;
    void outputEnabled;
    void durationMs;

    // Snap once when track/generation changes; later frames soft-correct toward live target.
    let forceSnap = gen !== lastGen || assetId !== lastAssetId;
    if (forceSnap) {
      lastGen = gen;
      lastAssetId = assetId;
    }

    const tick = () => {
      const nowMs = Date.now();
      let target = authoritativeTargetMs(nowMs);
      if (pendingSeekMs != null) {
        const live = audioPlayheadMs() ?? serverPlayheadMs(session, nowMs, durationMs);
        if (Math.abs(live - pendingSeekMs) <= PLAYHEAD_SEEK_CATCHUP_MS) {
          pendingSeekMs = null;
          target = live;
        } else {
          target = pendingSeekMs;
        }
      }
      renderMs = reconcilePlayhead(renderMs, target, forceSnap && pendingSeekMs == null);
      forceSnap = false;
    };

    tick();
    if (!isPlaying && pendingSeekMs == null) return;

    let raf = 0;
    const loop = () => {
      tick();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  });

  function stopBrowserAudio() {
    if (!audioEl) return;
    audioEl.pause();
    audioEl.removeAttribute("src");
    audioEl.load();
    delete audioEl.dataset.assetId;
  }

  async function applyTransport() {
    if (!audioEl || !session) return;

    if (!outputEnabled || !current?.playable) {
      stopBrowserAudio();
      appliedGen = session.playbackGeneration;
      return;
    }

    const url = `/api/media/${current.mediaAssetId}/audio`;
    const needSrc = audioEl.dataset.assetId !== current.mediaAssetId;
    if (needSrc) {
      pendingSeekMs = null;
      audioEl.src = url;
      audioEl.dataset.assetId = current.mediaAssetId;
      audioEl.load();
    }
    audioEl.volume = Math.max(0, Math.min(1, displayVolume / 100));
    const targetMs = pendingSeekMs ?? renderMs;
    const posSec = targetMs / 1000;
    try {
      if (Math.abs(audioEl.currentTime - posSec) > 0.75) {
        audioEl.currentTime = posSec;
      }
      if (pendingSeekMs != null && Math.abs(audioEl.currentTime * 1000 - pendingSeekMs) <= PLAYHEAD_SEEK_CATCHUP_MS) {
        pendingSeekMs = null;
      }
    } catch {
      // ignore until metadata ready
    }
    if (session.playbackState === "playing") {
      try {
        await audioEl.play();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Playback blocked");
      }
    } else {
      audioEl.pause();
    }
    appliedGen = session.playbackGeneration;
  }

  $effect(() => {
    const el = audioEl;
    if (!el) return;
    return registerPlaybackAudio(el);
  });

  $effect(() => {
    if (!session) return;
    void outputEnabled;
    void displayVolume;
    void session.playbackGeneration;
    void session.playbackState;
    void current?.mediaAssetId;
    void audioEl;
    if (outputEnabled && session.playbackGeneration === appliedGen && audioEl?.dataset.assetId === current?.mediaAssetId) {
      if (audioEl) audioEl.volume = Math.max(0, Math.min(1, displayVolume / 100));
      return;
    }
    if (!outputEnabled && session.playbackGeneration === appliedGen && !audioEl?.dataset.assetId) {
      return;
    }
    void applyTransport();
  });

  async function transport(action: "play" | "pause" | "skip" | "previous" | "seek" | "ended", positionMsArg?: number) {
    if (!session) return;
    busy = true;
    try {
      const res = await fetch(`/api/sessions/${session.id}/transport`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ action, positionMs: positionMsArg }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message ?? `Transport failed (${res.status})`);
      snapshot = body as SessionSnapshot;
      if (action === "skip" || action === "previous" || action === "ended") {
        pendingSeekMs = null;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Transport failed");
      if (action === "seek") pendingSeekMs = null;
    } finally {
      busy = false;
    }
  }

  function seekTo(ms: number) {
    const clamped = Math.max(0, Math.round(ms));
    pendingSeekMs = clamped;
    renderMs = clamped;
    void transport("seek", clamped);
  }

  $effect(() => {
    const el = audioEl;
    if (!el) return;
    const onEnded = () => {
      if ((!canSkip && !canPlayPause) || busy) return;
      void transport("ended");
    };
    el.addEventListener("ended", onEnded);
    return () => el.removeEventListener("ended", onEnded);
  });

  async function endSession() {
    if (!session) return;
    busy = true;
    try {
      const res = await fetch(`/api/sessions/${session.id}`, { method: "DELETE", credentials: "same-origin" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message ?? "End failed");
      snapshot = body as SessionSnapshot;
      endConfirmOpen = false;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "End failed");
    } finally {
      busy = false;
    }
  }

  function onVolumeInput(e: Event) {
    const next = Math.max(0, Math.min(100, Number((e.currentTarget as HTMLInputElement).value)));
    volumeScrub = next;
    if (audioEl) audioEl.volume = next / 100;
  }

  async function onVolumeCommit(e: Event) {
    if (!session || !snapshot.me?.userId) return;
    const next = Math.max(0, Math.min(100, Math.round(Number((e.currentTarget as HTMLInputElement).value))));
    volumeScrub = next;
    if (audioEl) audioEl.volume = next / 100;
    if (next === memberVolume) {
      volumeScrub = null;
      return;
    }
    volumeBusy = true;
    try {
      const res = await fetch(`/api/sessions/${session.id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ memberUserId: snapshot.me.userId, volume: next }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message ?? "Volume update failed");
      snapshot = body as SessionSnapshot;
      volumeScrub = null;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Volume update failed");
      volumeScrub = null;
    } finally {
      volumeBusy = false;
    }
  }
</script>

<div class="space-y-4 rounded-lg border border-border/70 bg-card p-4">
  <div class="flex flex-wrap items-start justify-between gap-3">
    <div class="min-w-0">
      <p class="font-mono text-[10px] tracking-[0.2em] text-signal uppercase">Now playing</p>
      {#if session?.name}
        <p class="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">{session.name}</p>
      {/if}
      <h2 class="mt-1 truncate text-xl font-semibold tracking-tight">
        {current?.title ?? (session?.status === "ended" ? "Session ended" : "Waiting for a track")}
      </h2>
      <p class="truncate font-mono text-xs text-muted-foreground">
        {current?.artists ?? "—"}
        {#if session}
          · {session.playbackState}{#if session.perpetual}
            · perpetual{/if}
        {/if}
      </p>
    </div>
    {#if session && session.status === "live"}
      <div class="text-right">
        <p class="font-mono text-[10px] text-muted-foreground uppercase">Join code</p>
        <p class="font-mono text-lg tracking-[0.25em] text-signal">{session.joinCode}</p>
      </div>
    {/if}
  </div>

  <div class="flex flex-wrap items-center gap-2">
    <button
      type="button"
      class="flex size-10 items-center justify-center rounded border border-border text-muted-foreground hover:bg-secondary disabled:opacity-40"
      disabled={!canSkip || busy || !current}
      aria-label="Previous"
      title="Previous"
      onclick={() => void transport("previous")}
    >
      <SkipBackIcon class="size-4" />
    </button>
    <button
      type="button"
      class="flex size-10 items-center justify-center rounded border border-signal/40 bg-signal/10 text-signal hover:bg-signal/20 disabled:opacity-40"
      disabled={!canPlayPause || busy || !current}
      aria-label={session?.playbackState === "playing" ? "Pause" : "Play"}
      onclick={() => void transport(session?.playbackState === "playing" ? "pause" : "play")}
    >
      {#if session?.playbackState === "playing"}
        <PauseIcon class="size-4" />
      {:else}
        <PlayIcon class="size-4" />
      {/if}
    </button>
    <button
      type="button"
      class="flex size-10 items-center justify-center rounded border border-border text-muted-foreground hover:bg-secondary disabled:opacity-40"
      disabled={!canSkip || busy}
      aria-label="Next"
      title="Next"
      onclick={() => void transport("skip")}
    >
      <SkipForwardIcon class="size-4" />
    </button>
    {#if !canPlayPause && !canSkip && session?.status === "live"}
      <span class="font-mono text-[11px] text-muted-foreground">Listen-only</span>
    {/if}
    {#if canEnd && session?.status === "live"}
      <button type="button" class="ml-auto font-mono text-[11px] text-destructive hover:underline" disabled={busy} onclick={() => (endConfirmOpen = true)}>
        End session
      </button>
    {/if}
  </div>

  <div class="flex items-center gap-2">
    <span class="w-9 shrink-0 font-mono text-[10px] text-muted-foreground tabular-nums">{formatClock(scrubMs ?? renderMs)}</span>
    <SeekBar
      class="h-1.5 w-full"
      valueMs={renderMs}
      {durationMs}
      disabled={!canSeek || !current || busy}
      onseek={seekTo}
      onscrub={(ms) => (scrubMs = ms)}
    />
    <span class="w-9 shrink-0 text-right font-mono text-[10px] text-muted-foreground tabular-nums">{formatClock(durationMs)}</span>
  </div>

  {#if session?.status === "live" && snapshot.me?.userId}
    <label class="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
      <Volume2Icon class="size-3.5 shrink-0" aria-hidden="true" />
      <span class="shrink-0">Your volume</span>
      <input
        class="zap-seek h-1.5 w-full cursor-pointer appearance-none rounded-full bg-border accent-[var(--signal)] disabled:opacity-40"
        type="range"
        min="0"
        max="100"
        step="1"
        value={displayVolume}
        disabled={volumeBusy || !outputEnabled}
        aria-label="Your volume"
        oninput={onVolumeInput}
        onchange={(e) => void onVolumeCommit(e)}
      />
      <span class="w-7 shrink-0 text-right tabular-nums">{displayVolume}</span>
    </label>
  {/if}

  {#if !outputEnabled && session?.status === "live"}
    <p class="font-mono text-[11px] text-muted-foreground">
      Your output is muted{#if canSetup}
        — change it in Setup{/if}.
    </p>
  {/if}

  <ConfirmDialog
    bind:open={endConfirmOpen}
    title="End session?"
    body={session?.perpetual ? "Ends this perpetual room for everyone and closes the join code." : "Stops playback for everyone and closes the join code."}
    confirmLabel="End session"
    danger
    {busy}
    onconfirm={endSession}
  />

  {#if !snapshot.me?.canAdd && snapshot.me?.role === "guest"}
    <p class="font-mono text-[11px] text-muted-foreground">You don’t have permission to add to the queue.</p>
  {/if}
</div>
