<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import SessionIndexRow from "$lib/components/SessionIndexRow.svelte";
  import StartSessionButton from "$lib/components/StartSessionButton.svelte";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  const live = $derived(data.indexSessions.filter((s) => s.status === "live"));
  const stalePerpetual = $derived(data.indexSessions.filter((s) => s.status === "stale" && s.perpetual));

  function refresh() {
    void invalidateAll();
  }
</script>

<section class="mx-auto max-w-lg space-y-6">
  <div>
    <h1 class="text-3xl font-semibold tracking-tight">Sessions</h1>
    <p class="mt-1 text-sm text-muted-foreground">Resume a live room, rejoin a perpetual session, or start as host.</p>
  </div>

  {#if live.length}
    <div class="space-y-2">
      <h2 class="font-mono text-xs tracking-[0.18em] text-muted-foreground uppercase">Live</h2>
      <ul class="space-y-2 rounded-lg border border-signal/40 bg-signal/10 p-4">
        {#each live as row (row.id)}
          <SessionIndexRow {row} mode="live" onchanged={refresh} />
        {/each}
      </ul>
    </div>
  {/if}

  {#if stalePerpetual.length}
    <div class="space-y-2">
      <h2 class="font-mono text-xs tracking-[0.18em] text-muted-foreground uppercase">Perpetual (idle)</h2>
      <ul class="space-y-2 rounded-lg border border-border/70 bg-card/30 p-4">
        {#each stalePerpetual as row (row.id)}
          <SessionIndexRow {row} mode="stale" onchanged={refresh} />
        {/each}
      </ul>
    </div>
  {/if}

  <div class="flex flex-wrap gap-3">
    {#if data.canStart}
      <StartSessionButton allowStart={true} showPerpetualOption showNameOption />
    {:else}
      <p class="font-mono text-xs text-muted-foreground">Guests can’t start — resume above or join a code.</p>
    {/if}
    <a href="/join" class="rounded border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary/60">Join</a>
  </div>
</section>
