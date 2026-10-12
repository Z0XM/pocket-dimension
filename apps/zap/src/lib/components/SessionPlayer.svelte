<script lang="ts">
  import PauseIcon from "@lucide/svelte/icons/pause";
  import PlayIcon from "@lucide/svelte/icons/play";
  import SkipForwardIcon from "@lucide/svelte/icons/skip-forward";
  import ConfirmDialog from "$lib/components/ConfirmDialog.svelte";
  import type { SessionSnapshot } from "$lib/server/sessions/types";

  let {
    snapshot = $bindable<SessionSnapshot>(),
    audioEl = $bindable<HTMLAudioElement | null>(null),
    discordSinkActive = false,
  }: {
    snapshot: SessionSnapshot;
    audioEl?: HTMLAudioElement | null;
    /** When Discord is attached, browser audio defaults off (Discord-only). */
    discordSinkActive?: boolean;
  } = $props();

  let busy = $state(false);
  let localError = $state<string | null>(null);
  let appliedGen = $state(-1);
  let endConfirmOpen = $state(false);
  /** null = follow default (off when Discord active, on otherwise). */
  let browserOutputOverride = $state<boolean | null>(null);

  const session = $derived(snapshot.session);
  const current = $derived(snapshot.currentItem);
  const canControl = $derived(Boolean(snapshot.me?.canControl));
  const canAdd = $derived(Boolean(snapshot.me?.canAdd));
  const canManage = $derived(Boolean(snapshot.me?.canManageGuests));
  const browserOutputEnabled = $derived(browserOutputOverride ?? !discordSinkActive);

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

    // Discord-only: don't pull media bytes into this browser.
    if (!browserOutputEnabled || !current?.playable) {
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
        localError = err instanceof Error ? err.message : "Playback blocked";
      }
    } else {
      audioEl.pause();
    }
    appliedGen = session.playbackGeneration;
  }

  $effect(() => {
    if (!session) return;
    void browserOutputEnabled;
    void session.playbackGeneration;
    void session.playbackState;
    void current?.mediaAssetId;
    void audioEl;
    if (browserOutputEnabled && session.playbackGeneration === appliedGen && audioEl?.dataset.assetId === current?.mediaAssetId) {
      return;
    }
    if (!browserOutputEnabled && session.playbackGeneration === appliedGen && !audioEl?.dataset.assetId) {
      return;
    }
    void applyTransport();
  });

  async function transport(action: "play" | "pause" | "skip" | "seek", positionMs?: number) {
    if (!session) return;
    busy = true;
    localError = null;
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
      localError = err instanceof Error ? err.message : "Transport failed";
    } finally {
      busy = false;
    }
  }

  async function togglePerm(key: "guestsCanAdd" | "guestsCanControl", value: boolean) {
    if (!session) return;
    busy = true;
    try {
      const res = await fetch(`/api/sessions/${session.id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message ?? "Update failed");
      snapshot = body as SessionSnapshot;
    } catch (err) {
      localError = err instanceof Error ? err.message : "Update failed";
    } finally {
      busy = false;
    }
  }

  async function endSession() {
    if (!session) return;
    busy = true;
    localError = null;
    try {
      const res = await fetch(`/api/sessions/${session.id}`, { method: "DELETE", credentials: "same-origin" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message ?? "End failed");
      snapshot = body as SessionSnapshot;
      endConfirmOpen = false;
    } catch (err) {
      localError = err instanceof Error ? err.message : "End failed";
    } finally {
      busy = false;
    }
  }

  function formatMs(ms: number) {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
  }
</script>

<div class="space-y-4 rounded-lg border border-border/70 bg-card/40 p-4">
  <div class="flex flex-wrap items-start justify-between gap-3">
    <div>
      <p class="font-mono text-[10px] tracking-[0.2em] text-signal uppercase">Now playing</p>
      <h2 class="mt-1 text-xl font-semibold tracking-tight">
        {current?.title ?? (session?.status === "ended" ? "Session ended" : "Waiting for a track")}
      </h2>
      <p class="font-mono text-xs text-muted-foreground">
        {current?.artists ?? "—"}
        {#if session}
          · gen {session.playbackGeneration} · {session.playbackState}
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
      class="flex size-10 items-center justify-center rounded border border-signal/40 bg-signal/10 text-signal hover:bg-signal/20 disabled:opacity-40"
      disabled={!canControl || busy || !current}
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
      disabled={!canControl || busy}
      aria-label="Skip"
      onclick={() => void transport("skip")}
    >
      <SkipForwardIcon class="size-4" />
    </button>
    <span class="font-mono text-[11px] text-muted-foreground">
      {formatMs(estimatedPositionMs())}
      {#if current?.durationMs}
        / {formatMs(current.durationMs)}
      {/if}
    </span>
    {#if !canControl && session?.status === "live"}
      <span class="font-mono text-[11px] text-muted-foreground">Listen-only</span>
    {/if}
  </div>

  {#if session?.status === "live"}
    <div class="flex flex-wrap items-center gap-4 border-t border-border/50 pt-3 font-mono text-[11px]">
      <span class="tracking-[0.14em] text-muted-foreground uppercase">Outputs</span>
      <label class="flex items-center gap-2" title={discordSinkActive ? "Off by default while Discord is attached" : "Play audio in this browser"}>
        <input
          class="zap-checkbox"
          type="checkbox"
          checked={browserOutputEnabled}
          onchange={(e) => {
            browserOutputOverride = (e.currentTarget as HTMLInputElement).checked;
          }}
        />
        This browser
        {#if discordSinkActive && !browserOutputEnabled}
          <span class="text-muted-foreground">(Discord only)</span>
        {/if}
      </label>
      {#if discordSinkActive}
        <span class="text-signal">Discord</span>
      {/if}
    </div>
  {/if}

  {#if canManage && session?.status === "live"}
    <div class="flex flex-wrap gap-4 border-t border-border/50 pt-3 font-mono text-[11px]">
      <label class="flex items-center gap-2">
        <input
          class="zap-checkbox"
          type="checkbox"
          checked={session.guestsCanAdd}
          disabled={busy}
          onchange={(e) => void togglePerm("guestsCanAdd", (e.currentTarget as HTMLInputElement).checked)}
        />
        Guests can add
      </label>
      <label class="flex items-center gap-2">
        <input
          class="zap-checkbox"
          type="checkbox"
          checked={session.guestsCanControl}
          disabled={busy}
          onchange={(e) => void togglePerm("guestsCanControl", (e.currentTarget as HTMLInputElement).checked)}
        />
        Guests can control
      </label>
      <button type="button" class="text-destructive hover:underline" disabled={busy} onclick={() => (endConfirmOpen = true)}> End session </button>
    </div>
  {/if}

  <ConfirmDialog
    bind:open={endConfirmOpen}
    title="End session?"
    body="Stops playback for everyone and closes the join code."
    confirmLabel="End session"
    danger
    {busy}
    onconfirm={endSession}
  />

  {#if localError}
    <p class="font-mono text-[11px] text-destructive">{localError}</p>
  {/if}

  {#if !canAdd && snapshot.me?.role === "guest"}
    <p class="font-mono text-[11px] text-muted-foreground">Host has not enabled queue add for guests.</p>
  {/if}
</div>
