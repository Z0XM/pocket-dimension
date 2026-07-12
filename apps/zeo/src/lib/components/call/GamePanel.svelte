<script lang="ts">
  import Gamepad2Icon from "@lucide/svelte/icons/gamepad-2";
  import XIcon from "@lucide/svelte/icons/x";
  import type { GameSnapshot } from "$lib/server/game/types";

  type Props = {
    open: boolean;
    bottomInset?: number;
    isHost: boolean;
    slug: string;
    snapshot: GameSnapshot | null;
    busy?: boolean;
    onClose: () => void;
    onSnapshot: (snapshot: GameSnapshot | null) => void;
    onBusyChange?: (busy: boolean) => void;
  };

  let {
    open,
    bottomInset = 0,
    isHost,
    slug,
    snapshot,
    busy = false,
    onClose,
    onSnapshot,
    onBusyChange,
  }: Props = $props();

  let tab = $state<"setup" | "scoreboard">("setup");
  let errorMessage = $state<string | null>(null);

  const gameActive = $derived(snapshot?.session?.status === "active");
  const panelBottomPx = $derived(Math.max(16, bottomInset + 16));

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
    void runGameAction(() =>
      fetch(`/api/rooms/${slug}/game`, {
        method: "DELETE",
      })
    );
  }
</script>

{#if open}
  <div
    class="absolute inset-x-2 z-30 w-auto max-w-sm rounded-xl border border-border bg-card/95 p-4 shadow-lg backdrop-blur-sm safe-x sm:left-4 sm:inset-x-auto"
    style:bottom="{panelBottomPx}px"
    role="dialog"
    aria-label="Game mode"
  >
    <div class="mb-3 flex items-center justify-between gap-2">
      <div class="flex items-center gap-2">
        <Gamepad2Icon class="size-4 text-participant-orange" aria-hidden="true" />
        <p class="text-sm font-medium text-foreground">Game mode</p>
      </div>
      <button type="button" class="action-btn-ghost-destructive size-11 sm:size-7" aria-label="Close game panel" onclick={onClose}>
        <XIcon class="size-4" aria-hidden="true" />
      </button>
    </div>

    <div class="mb-3 flex gap-1 rounded-lg border border-border p-1">
      <button
        type="button"
        class="flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors {tab === 'setup' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary/60'}"
        onclick={() => (tab = "setup")}
      >
        Setup
      </button>
      <button
        type="button"
        class="flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors {tab === 'scoreboard' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary/60'}"
        onclick={() => (tab = "scoreboard")}
      >
        Scoreboard
      </button>
    </div>

    {#if errorMessage}
      <p class="mb-3 text-xs text-destructive">{errorMessage}</p>
    {/if}

    {#if tab === "setup"}
      {#if gameActive}
        <div class="space-y-3 text-sm">
          <p class="text-muted-foreground">
            {snapshot?.session?.gameType === "charades" ? "Charades" : "Game"} is active with {snapshot?.teams.length ?? 0} teams.
          </p>
          <ul class="space-y-1 text-xs text-muted-foreground">
            {#each snapshot?.teams ?? [] as team (team.id)}
              <li>{team.name}: {team.memberUserIds.length} players</li>
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
          <p class="text-sm text-muted-foreground">Start Charades with two teams. Gameplay rounds arrive in a later release.</p>
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
    {:else}
      {#if snapshot?.roomScores?.length}
        <ul class="space-y-2">
          {#each snapshot.roomScores as score (score.userId)}
            <li class="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
              <span>{score.displayName}</span>
              <span class="font-medium text-foreground">{score.totalScore}</span>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="text-sm text-muted-foreground">No scores yet. Points appear after Charades rounds.</p>
      {/if}
    {/if}
  </div>
{/if}
