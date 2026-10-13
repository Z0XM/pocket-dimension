<script lang="ts">
  import StartSessionButton from "$lib/components/StartSessionButton.svelte";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
</script>

<section class="mx-auto max-w-lg space-y-6">
  <div>
    <h1 class="text-3xl font-semibold tracking-tight">Session</h1>
    <p class="mt-1 text-sm text-muted-foreground">No live room selected. Resume, join, or start as host.</p>
  </div>

  {#if data.liveSessions.length}
    <ul class="space-y-2 rounded-lg border border-signal/40 bg-signal/10 p-4">
      {#each data.liveSessions as live (live.id)}
        <li class="flex items-center justify-between gap-2 text-sm">
          <span>
            <span class="font-mono text-signal">{live.joinCode}</span>
            <span class="text-muted-foreground"> · {live.role}</span>
          </span>
          <a href={`/session/${live.id}`} class="rounded border border-border px-2 py-1 font-mono text-[10px]">Resume</a>
        </li>
      {/each}
    </ul>
  {/if}

  <div class="flex flex-wrap gap-3">
    {#if data.canStart}
      <StartSessionButton allowStart={true} />
    {:else}
      <p class="font-mono text-xs text-muted-foreground">Guests can’t start — resume above or join a code.</p>
    {/if}
    <a href="/join" class="rounded border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary/60">Join</a>
  </div>
</section>
