<script lang="ts">
  import PauseIcon from "@lucide/svelte/icons/pause";
  import PlayIcon from "@lucide/svelte/icons/play";
  import SkipBackIcon from "@lucide/svelte/icons/skip-back";
  import SkipForwardIcon from "@lucide/svelte/icons/skip-forward";
  import ConfirmDialog from "$lib/components/ConfirmDialog.svelte";
  import { toast } from "$lib/toast.svelte";
  import { formatClock } from "$lib/catalog-queue";
  import { registerPlaybackAudio } from "$lib/playback-audio";
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

  const session = $derived(snapshot.session);
  const current = $derived(snapshot.currentItem);
  const canPlayPause = $derived(Boolean(snapshot.me?.canPlayPause));
  const canSkip = $derived(Boolean(snapshot.me?.canSkip));
  const canSeek = $derived(Boolean(snapshot.me?.canSeek));
  const canSetup = $derived(Boolean(snapshot.me?.canSetup));
  const canEnd = $derived(snapshot.me?.role === "host");
  const myMember = $derived(snapshot.members.find((m) => m.userId === snapshot.me?.userId) ?? null);
  const outputEnabled = $derived(myMember?.outputEnabled ?? true);
  const volume = $derived(myMember?.volume ?? 100);
  const durationMs = $derived(current?.durationMs ?? 0);

  function estimatedPositionMs(): number {
    if (!session) return 0;
    if (session.playbackState !== "playing") return session.positionMs;
    const base = new Date(session.positionUpdatedAt).getTime();
    return Math.max(0, session.positionMs + (Date.now() - base));
  }

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
      audioEl.src = url;
      audioEl.dataset.assetId = current.mediaAssetId;
      audioEl.load();
    }
    audioEl.volume = Math.max(0, Math.min(1, volume / 100));
    const posSec = estimatedPositionMs() / 1000;
    try {
      if (Math.abs(audioEl.currentTime - posSec) > 0.75) {
        audioEl.currentTime = posSec;
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
    void volume;
    void session.playbackGeneration;
    void session.playbackState;
    void current?.mediaAssetId;
    void audioEl;
    if (outputEnabled && session.playbackGeneration === appliedGen && audioEl?.dataset.assetId === current?.mediaAssetId) {
      if (audioEl) audioEl.volume = Math.max(0, Math.min(1, volume / 100));
      return;
    }
    if (!outputEnabled && session.playbackGeneration === appliedGen && !audioEl?.dataset.assetId) {
      return;
    }
    void applyTransport();
  });

  async function transport(action: "play" | "pause" | "skip" | "previous" | "seek" | "ended", positionMs?: number) {
    if (!session) return;
    busy = true;
    try {
      const res = await fetch(`/api/sessions/${session.id}/transport`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ action, positionMs }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message ?? `Transport failed (${res.status})`);
      snapshot = body as SessionSnapshot;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Transport failed");
    } finally {
      busy = false;
    }
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

  function onSeekInput(e: Event) {
    scrubMs = Number((e.currentTarget as HTMLInputElement).value) * 1000;
  }

  function onSeekCommit(e: Event) {
    const ms = Number((e.currentTarget as HTMLInputElement).value) * 1000;
    scrubMs = null;
    if (Number.isFinite(ms)) void transport("seek", ms);
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
    <span class="w-9 shrink-0 font-mono text-[10px] text-muted-foreground tabular-nums">{formatClock(scrubMs ?? estimatedPositionMs())}</span>
    <input
      class="zap-seek h-1.5 w-full cursor-pointer appearance-none rounded-full bg-border accent-[var(--signal)] disabled:opacity-40"
      type="range"
      min="0"
      max={Math.max(durationMs / 1000, 1)}
      step="0.5"
      value={(scrubMs ?? estimatedPositionMs()) / 1000}
      disabled={!canSeek || !current || busy}
      aria-label="Seek"
      oninput={onSeekInput}
      onchange={onSeekCommit}
    />
    <span class="w-9 shrink-0 text-right font-mono text-[10px] text-muted-foreground tabular-nums">{formatClock(durationMs)}</span>
  </div>

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
