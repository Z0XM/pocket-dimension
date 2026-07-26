<script lang="ts">
  import Gamepad2Icon from "@lucide/svelte/icons/gamepad-2";
  import LayoutGridIcon from "@lucide/svelte/icons/layout-grid";
  import Music2Icon from "@lucide/svelte/icons/music-2";
  import XIcon from "@lucide/svelte/icons/x";
  import type { GameSnapshot } from "$lib/server/game/types";
  import type { ListeningSnapshot } from "$lib/server/listening/types";

  type Props = {
    open: boolean;
    bottomInset?: number;
    isHost: boolean;
    userId: string;
    slug: string;
    snapshot: GameSnapshot | null;
    listeningSnapshot?: ListeningSnapshot | null;
    youtubeLinked?: boolean;
    busy?: boolean;
    listeningBusy?: boolean;
    onClose: () => void;
    onSnapshot: (snapshot: GameSnapshot | null) => void;
    onListeningSnapshot?: (snapshot: ListeningSnapshot | null) => void;
    onYouTubeLinked?: () => void;
    onBusyChange?: (busy: boolean) => void;
    onListeningBusyChange?: (busy: boolean) => void;
  };

  let {
    open,
    bottomInset = 0,
    isHost,
    userId,
    slug,
    snapshot,
    listeningSnapshot = null,
    youtubeLinked = false,
    busy = false,
    listeningBusy = false,
    onClose,
    onSnapshot,
    onListeningSnapshot,
    onYouTubeLinked,
    onBusyChange,
    onListeningBusyChange,
  }: Props = $props();

  let tab = $state<"apps" | "games" | "scoreboard">("apps");
  let errorMessage = $state<string | null>(null);
  let listeningError = $state<string | null>(null);
  let stopYouTubeOAuthWatch: (() => void) | null = null;

  $effect(() => {
    return () => {
      stopYouTubeOAuthWatch?.();
      stopYouTubeOAuthWatch = null;
    };
  });

  const gameActive = $derived(snapshot?.session?.status === "active");
  const listeningActive = $derived(Boolean(listeningSnapshot?.session && !listeningSnapshot.session.endedAt));
  const canEndListening = $derived(
    listeningActive && (isHost || listeningSnapshot?.session?.djUserId === userId || listeningSnapshot?.session?.linkerUserId === userId)
  );
  const round = $derived(snapshot?.round ?? null);
  const panelBottomPx = $derived(Math.max(16, bottomInset + 16));
  const selfParticipant = $derived(snapshot?.participants.find((participant) => participant.userId === userId) ?? null);
  const readyCount = $derived(snapshot?.participants.filter((participant) => participant.isReady).length ?? 0);
  const totalPlayers = $derived(snapshot?.participants.length ?? 0);
  const allReady = $derived(totalPlayers > 0 && readyCount === totalPlayers);

  async function runGameAction(action: () => Promise<Response>) {
    errorMessage = null;
    onBusyChange?.(true);
    try {
      const response = await action();
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? `Request failed (${response.status})`);
      }
      const next = (await response.json()) as GameSnapshot;
      onSnapshot(next.session?.status === "active" ? next : null);
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : "Something went wrong";
    } finally {
      onBusyChange?.(false);
    }
  }

  async function runListeningAction(action: () => Promise<Response>) {
    listeningError = null;
    onListeningBusyChange?.(true);
    try {
      const response = await action();
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string; error?: string } | null;
        throw new Error(body?.message ?? body?.error ?? `Request failed (${response.status})`);
      }
      const next = (await response.json()) as ListeningSnapshot;
      onListeningSnapshot?.(next.session && !next.session.endedAt ? next : null);
    } catch (error) {
      listeningError = error instanceof Error ? error.message : "Something went wrong";
    } finally {
      onListeningBusyChange?.(false);
    }
  }

  function startCharades() {
    void runGameAction(() =>
      fetch(`/api/rooms/${slug}/game`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameType: "charades", teamCount: 2 }),
      })
    );
  }

  function endGame() {
    void runGameAction(() => fetch(`/api/rooms/${slug}/game`, { method: "DELETE" }));
  }

  function markReady() {
    void runGameAction(() => fetch(`/api/rooms/${slug}/game/rounds/ready`, { method: "POST" }));
  }

  function startRoundOne() {
    void runGameAction(() => fetch(`/api/rooms/${slug}/game/rounds/start`, { method: "POST" }));
  }

  function connectYouTube() {
    stopYouTubeOAuthWatch?.();
    stopYouTubeOAuthWatch = null;

    const returnTo = encodeURIComponent(`/room/${slug}`);
    const startUrl = `/api/auth/youtube/start?returnTo=${returnTo}&popup=1`;
    const popup = window.open(startUrl, "zeo-youtube-oauth", "popup,width=520,height=720");
    if (!popup) {
      window.location.href = `/api/auth/youtube/start?returnTo=${returnTo}`;
      return;
    }

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { type?: string; status?: string } | null;
      if (data?.type !== "zeo-youtube-oauth" || data.status !== "linked") return;
      cleanup();
      onYouTubeLinked?.();
    };

    const poll = window.setInterval(() => {
      if (!popup.closed) return;
      cleanup();
      onYouTubeLinked?.();
    }, 500);

    function cleanup() {
      window.removeEventListener("message", onMessage);
      window.clearInterval(poll);
      if (stopYouTubeOAuthWatch === cleanup) stopYouTubeOAuthWatch = null;
    }

    stopYouTubeOAuthWatch = cleanup;
    window.addEventListener("message", onMessage);
  }

  function startListening() {
    void runListeningAction(() => fetch(`/api/rooms/${slug}/listening`, { method: "POST" }));
  }

  function endListening() {
    void runListeningAction(() => fetch(`/api/rooms/${slug}/listening`, { method: "DELETE" }));
  }
</script>

{#if open}
  <div
    class="absolute inset-x-2 z-30 w-auto max-w-sm rounded-xl border border-border bg-card/95 p-4 shadow-lg backdrop-blur-sm safe-x sm:left-4 sm:inset-x-auto"
    style:bottom="{panelBottomPx}px"
    role="dialog"
    aria-label="Games and Apps"
  >
    <div class="mb-3 flex items-center justify-between gap-2">
      <div class="flex items-center gap-2">
        <LayoutGridIcon class="size-4 text-participant-orange" aria-hidden="true" />
        <p class="text-sm font-medium text-foreground">Games and Apps</p>
      </div>
      <button type="button" class="action-btn-ghost-destructive size-11 sm:size-7" aria-label="Close games and apps" onclick={onClose}>
        <XIcon class="size-4" aria-hidden="true" />
      </button>
    </div>

    <div class="mb-3 flex gap-1 rounded-lg border border-border p-1">
      <button
        type="button"
        class="flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors {tab === 'apps'
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:bg-secondary/60'}"
        onclick={() => (tab = "apps")}
      >
        Apps
      </button>
      <button
        type="button"
        class="flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors {tab === 'games'
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:bg-secondary/60'}"
        onclick={() => (tab = "games")}
      >
        Games
      </button>
      <button
        type="button"
        class="flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors {tab === 'scoreboard'
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:bg-secondary/60'}"
        onclick={() => (tab = "scoreboard")}
      >
        Scoreboard
      </button>
    </div>

    {#if tab === "apps"}
      {#if listeningError}
        <p class="mb-3 text-xs text-destructive">{listeningError}</p>
      {/if}

      <div class="rounded-lg border border-border p-3">
        <div class="mb-2 flex items-center gap-2">
          <Music2Icon class="size-4 text-participant-orange" aria-hidden="true" />
          <p class="text-sm font-medium text-foreground">Shared Listening</p>
        </div>
        <p class="mb-3 text-xs text-muted-foreground">
          {#if listeningActive}
            Session is live. Use the music tile for playback, search, and queue.
          {:else}
            Play YouTube tracks for the whole room from one linked account.
          {/if}
        </p>
        {#if !youtubeLinked}
          <button type="button" class="w-full rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground" onclick={connectYouTube}>
            Connect YouTube
          </button>
        {:else if listeningActive}
          {#if canEndListening}
            <button
              type="button"
              class="w-full rounded-lg bg-destructive px-3 py-2 text-sm font-medium text-destructive-foreground disabled:opacity-60"
              disabled={listeningBusy}
              onclick={endListening}
            >
              {listeningBusy ? "Ending…" : "End"}
            </button>
          {:else}
            <p class="text-xs text-muted-foreground">Listening is active. Ask the host or DJ to end it.</p>
          {/if}
        {:else}
          <button
            type="button"
            class="w-full rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
            disabled={listeningBusy}
            onclick={startListening}
          >
            {listeningBusy ? "Starting…" : "Start"}
          </button>
        {/if}
      </div>
    {:else if tab === "games"}
      {#if errorMessage}
        <p class="mb-3 text-xs text-destructive">{errorMessage}</p>
      {/if}

      {#if gameActive}
        <div class="space-y-3 text-sm">
          {#if !round}
            <p class="text-muted-foreground">Everyone marks ready, then the host starts round 1.</p>
            <p class="text-xs text-muted-foreground">{readyCount}/{totalPlayers} ready</p>
            <ul class="space-y-1.5">
              {#each snapshot?.participants ?? [] as participant (participant.userId)}
                <li class="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-xs">
                  <span class="flex items-center gap-2">
                    <span
                      class="size-2.5 rounded-full"
                      style:background-color={snapshot?.teams.find((team) => team.id === participant.teamId)?.colorKey ?? "#888"}
                    ></span>
                    {participant.displayName}
                  </span>
                  <span class={participant.isReady ? "text-participant-orange" : "text-muted-foreground"}>
                    {participant.isReady ? "Ready" : "Waiting"}
                  </span>
                </li>
              {/each}
            </ul>
            {#if selfParticipant && !selfParticipant.isReady}
              <button
                type="button"
                class="w-full rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
                disabled={busy}
                onclick={markReady}
              >
                {busy ? "Saving…" : "I'm ready"}
              </button>
            {:else if selfParticipant?.isReady}
              <p class="text-xs text-participant-orange">You are ready.</p>
            {/if}
            {#if isHost}
              <button
                type="button"
                class="w-full rounded-lg bg-secondary px-3 py-2 text-sm font-medium text-foreground disabled:opacity-60"
                disabled={busy || !allReady}
                onclick={startRoundOne}
              >
                {busy ? "Starting…" : "Start round 1"}
              </button>
              {#if !allReady}
                <p class="text-xs text-muted-foreground">Waiting for all players to mark ready.</p>
              {/if}
            {/if}
          {:else if round.phase === "ready_check"}
            <p class="text-muted-foreground">Round {round.roundNumber} finished — mark ready for the next round.</p>
            <p class="text-xs text-muted-foreground">{readyCount}/{totalPlayers} ready</p>
            {#if selfParticipant && !selfParticipant.isReady}
              <button
                type="button"
                class="w-full rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
                disabled={busy}
                onclick={markReady}
              >
                {busy ? "Saving…" : "I'm ready"}
              </button>
            {:else if selfParticipant?.isReady}
              <p class="text-xs text-participant-orange">You are ready. Waiting for others…</p>
            {/if}
          {:else}
            <p class="text-muted-foreground">
              Round {round.roundNumber} — {round.phase.replaceAll("_", " ")}
            </p>
            <p class="text-xs text-muted-foreground">Word submission and guessing controls arrive in the next release.</p>
          {/if}

          <ul class="space-y-1 text-xs text-muted-foreground">
            {#each snapshot?.teams ?? [] as team (team.id)}
              <li class="flex items-center gap-2">
                <span class="size-2.5 rounded-full" style:background-color={team.colorKey}></span>
                {team.name}: {team.score} pts · {team.memberUserIds.length} players
              </li>
            {/each}
          </ul>

          {#if isHost}
            <button
              type="button"
              class="w-full rounded-lg bg-destructive px-3 py-2 text-sm font-medium text-destructive-foreground disabled:opacity-60"
              disabled={busy}
              onclick={endGame}
            >
              {busy ? "Ending…" : "End game"}
            </button>
          {/if}
        </div>
      {:else if isHost}
        <div class="space-y-3">
          <div class="mb-1 flex items-center gap-2">
            <Gamepad2Icon class="size-4 text-participant-orange" aria-hidden="true" />
            <p class="text-sm font-medium text-foreground">Charades</p>
          </div>
          <p class="text-sm text-muted-foreground">Start Charades with two teams. Players will mark ready before round 1.</p>
          <button
            type="button"
            class="w-full rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
            disabled={busy}
            onclick={startCharades}
          >
            {busy ? "Starting…" : "Start Charades"}
          </button>
        </div>
      {:else}
        <p class="text-sm text-muted-foreground">Waiting for the host to start a game.</p>
      {/if}
    {:else if snapshot?.roomScores?.length}
      <ul class="space-y-2">
        {#each snapshot.roomScores as score (score.userId)}
          <li class="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
            <span>{score.displayName}</span>
            <span class="font-medium text-foreground">{score.totalScore}</span>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="text-sm text-muted-foreground">No scores yet. Points appear after accepted guesses.</p>
    {/if}
  </div>
{/if}
