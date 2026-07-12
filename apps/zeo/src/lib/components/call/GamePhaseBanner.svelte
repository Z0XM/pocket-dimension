<script lang="ts">
  import type { GameSnapshot } from "$lib/server/game/types";

  type Props = {
    snapshot: GameSnapshot | null;
  };

  let { snapshot }: Props = $props();

  const gameActive = $derived(snapshot?.session?.status === "active");
  const round = $derived(snapshot?.round ?? null);
  const readyCount = $derived(snapshot?.participants.filter((participant) => participant.isReady).length ?? 0);
  const totalPlayers = $derived(snapshot?.participants.length ?? 0);

  const label = $derived.by(() => {
    if (!gameActive) return null;
    if (!round) {
      return `Lobby — ${readyCount}/${totalPlayers} ready`;
    }

    switch (round.phase) {
      case "submission":
        return `Round ${round.roundNumber} — proposing team picks a word`;
      case "passed_on":
        return `Round ${round.roundNumber} — mime gets the word`;
      case "act":
        return `Round ${round.roundNumber} — act it out`;
      case "verdict":
        return `Round ${round.roundNumber} — accept or reject the guess`;
      case "ready_check":
        return `Round ${round.roundNumber} — ready check (${readyCount}/${totalPlayers})`;
      case "completed":
        return `Round ${round.roundNumber} complete`;
      default:
        return `Round ${round.roundNumber}`;
    }
  });
</script>

{#if label}
  <div
    class="pointer-events-none absolute inset-x-0 top-3 z-30 flex justify-center px-4 safe-top"
    role="status"
    aria-live="polite"
  >
    <div class="rounded-full border border-border bg-card/95 px-4 py-2 text-sm font-medium text-foreground shadow-lg backdrop-blur-sm">
      {label}
    </div>
  </div>
{/if}
