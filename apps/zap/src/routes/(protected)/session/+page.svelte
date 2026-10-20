<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import JoinSessionForm from "$lib/components/JoinSessionForm.svelte";
  import SessionIndexRow from "$lib/components/SessionIndexRow.svelte";
  import StartSessionButton from "$lib/components/StartSessionButton.svelte";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  const live = $derived(data.indexSessions.filter((s) => s.status === "live"));
  const stalePerpetual = $derived(data.indexSessions.filter((s) => s.status === "stale" && s.perpetual));
  const hasListed = $derived(live.length > 0 || stalePerpetual.length > 0);

  function refresh() {
    void invalidateAll();
  }
</script>

<section class="mx-auto max-w-2xl space-y-8">
  <div>
    <h1 class="text-3xl font-semibold tracking-tight">Sessions</h1>
    <p class="mt-1 text-sm text-muted-foreground">Resume a live room, start as host, or join with a code.</p>
  </div>

  <div class="space-y-4">
    <h2 class="font-mono text-xs tracking-[0.18em] text-muted-foreground uppercase">Your sessions</h2>
    {#if live.length}
      <div class="space-y-2">
        <h3 class="font-mono text-[10px] tracking-[0.18em] text-signal uppercase">Live</h3>
        <ul class="space-y-2 rounded-lg border border-signal/40 bg-signal/10 p-4">
          {#each live as row (row.id)}
            <SessionIndexRow {row} mode="live" onchanged={refresh} />
          {/each}
        </ul>
      </div>
    {/if}

    {#if stalePerpetual.length}
      <div class="space-y-2">
        <h3 class="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">Perpetual (idle)</h3>
        <ul class="space-y-2 rounded-lg border border-border/70 bg-card/30 p-4">
          {#each stalePerpetual as row (row.id)}
            <SessionIndexRow {row} mode="stale" onchanged={refresh} />
          {/each}
        </ul>
      </div>
    {/if}

    {#if !hasListed}
      <p class="rounded border border-dashed border-border/70 px-4 py-6 text-center text-sm text-muted-foreground">
        No sessions yet. Start one below or join with a code.
      </p>
    {/if}
  </div>

  <div class="grid gap-4 sm:grid-cols-2">
    <div class="space-y-3 rounded-lg border border-border/70 bg-card/30 p-4">
      <div>
        <h2 class="font-mono text-xs tracking-[0.18em] text-muted-foreground uppercase">Start a session</h2>
        <p class="mt-1 text-xs text-muted-foreground">Host a new room on this device.</p>
      </div>
      {#if data.canStart}
        <StartSessionButton
          allowStart={true}
          createOnly
          showPerpetualOption
          showNameOption
          label="Start session"
          class="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40"
        />
      {:else}
        <p class="font-mono text-xs text-muted-foreground">Guests can’t start — resume above or join a code.</p>
      {/if}
    </div>

    <div class="space-y-3 rounded-lg border border-border/70 bg-card/30 p-4">
      <div>
        <h2 class="font-mono text-xs tracking-[0.18em] text-muted-foreground uppercase">Join a session</h2>
        <p class="mt-1 text-xs text-muted-foreground">Enter a host’s join code.</p>
      </div>
      <JoinSessionForm fullWidth={false} />
    </div>
  </div>
</section>
