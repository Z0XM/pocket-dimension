<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import DoorOpenIcon from "@lucide/svelte/icons/door-open";
  import RadioIcon from "@lucide/svelte/icons/radio";
  import JoinSessionForm from "$lib/components/JoinSessionForm.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
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

<section class="zap-page">
  <PageHeader title="Sessions" />

  <div class="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overscroll-contain">
    <div class="space-y-4">
      <h2 class="zap-section-label font-mono text-[10px] tracking-[0.18em] uppercase">Your sessions</h2>
      {#if live.length}
        <div class="space-y-2">
          <h3 class="font-mono text-[10px] tracking-[0.18em] text-signal uppercase">Live</h3>
          <ul class="zap-track-host space-y-0 divide-y divide-border/60 px-4 py-2">
            {#each live as row (row.id)}
              <SessionIndexRow {row} mode="live" onchanged={refresh} />
            {/each}
          </ul>
        </div>
      {/if}

      {#if stalePerpetual.length}
        <div class="space-y-2">
          <h3 class="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">Perpetual (idle)</h3>
          <ul class="zap-track-host space-y-0 divide-y divide-border/60 px-4 py-2">
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
      <div class="zap-filters-panel space-y-3 p-4">
        <h2 class="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
          <RadioIcon class="size-3.5 text-signal" aria-hidden="true" />
          Start a session
        </h2>
        {#if data.canStart}
          <StartSessionButton
            allowStart={true}
            createOnly
            showPerpetualOption
            showNameOption
            defaultName={data.defaultSessionName}
            label="Start session"
            class="inline-flex items-center gap-1.5 rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40"
          />
        {:else}
          <p class="font-mono text-xs text-muted-foreground">Guests can’t start — resume above or join a code.</p>
        {/if}
      </div>

      <div class="zap-filters-panel space-y-3 p-4">
        <h2 class="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
          <DoorOpenIcon class="size-3.5 text-signal" aria-hidden="true" />
          Join a session
        </h2>
        <JoinSessionForm fullWidth={false} />
      </div>
    </div>
  </div>
</section>
