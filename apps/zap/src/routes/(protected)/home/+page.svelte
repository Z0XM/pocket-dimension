<script lang="ts">
  import WaveBars from "$lib/components/WaveBars.svelte";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
</script>

<section class="space-y-10">
  <div>
    <p class="font-mono text-xs tracking-[0.35em] text-signal/80 uppercase">Zap</p>
    <h1 class="mt-2 text-4xl font-semibold tracking-tight md:text-5xl">Home</h1>
    <div class="mt-4">
      <WaveBars />
    </div>
  </div>

  {#if data.liveSessions.length}
    <div class="rounded-lg border border-signal/40 bg-signal/10 px-4 py-4">
      <p class="font-mono text-[10px] tracking-[0.18em] text-signal uppercase">Live — pick up where you left off</p>
      <ul class="mt-3 space-y-2">
        {#each data.liveSessions as live (live.id)}
          <li class="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span>
              <span class="font-mono text-signal">{live.joinCode}</span>
              <span class="text-muted-foreground"> · {live.role} · {live.playbackState}</span>
              {#if live.currentTitle}
                <span class="text-foreground"> — {live.currentTitle}</span>
              {/if}
            </span>
            <a href={`/session/${live.id}`} class="rounded border border-border px-3 py-1.5 font-mono text-[10px] hover:bg-secondary/60"> Resume </a>
          </li>
        {/each}
      </ul>
    </div>
  {/if}

  <div class="flex flex-wrap gap-3">
    <a
      href="/session?stay=1"
      class="rounded bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
    >
      Go to sessions
    </a>
    <a href="/join" class="rounded border border-border bg-secondary/60 px-5 py-2.5 text-sm text-secondary-foreground hover:bg-secondary"> Join </a>
    <a href="/catalogue" class="rounded border border-border px-5 py-2.5 text-sm text-muted-foreground hover:bg-secondary/40"> Catalogue </a>
    {#if data.isAdmin}
      <a href="/admin" class="rounded border border-signal/40 bg-signal/10 px-5 py-2.5 text-sm text-signal hover:bg-signal/20"> Admin </a>
    {/if}
  </div>

  <div class="space-y-2">
    <div class="flex items-baseline justify-between gap-2">
      <h2 class="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">Playlists</h2>
      <a href="/playlists" class="font-mono text-[10px] text-signal hover:underline">
        {data.playlistCount > data.playlists.length ? `All ${data.playlistCount}` : "Manage"}
      </a>
    </div>
    {#if data.playlists.length === 0}
      <p class="rounded border border-dashed border-border/70 px-4 py-6 text-center text-sm text-muted-foreground">
        No playlists yet. <a href="/playlists" class="text-signal hover:underline">Create one</a>.
      </p>
    {:else}
      <ul class="divide-y divide-border/50 rounded-lg border border-border/70 bg-card/30">
        {#each data.playlists as pl (pl.id)}
          <li>
            <a href={`/playlists/${pl.id}`} class="block px-4 py-2.5 text-sm hover:text-signal">
              <span class="font-medium">{pl.name}</span>
              <span class="ml-2 font-mono text-[10px] text-muted-foreground"
                >{pl.trackCount} · {pl.visibility}{#if pl.ownerUserId !== data.user?.id}
                  · collab{/if}</span
              >
            </a>
          </li>
        {/each}
      </ul>
    {/if}
  </div>

  {#if data.playHistory.length}
    <div class="space-y-2">
      <div class="flex items-baseline justify-between gap-2">
        <h2 class="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">Recent plays</h2>
        <a href="/history" class="font-mono text-[10px] text-signal hover:underline">History</a>
      </div>
      <ul class="divide-y divide-border/50 rounded-lg border border-border/70 bg-card/30">
        {#each data.playHistory as play (play.id)}
          <li class="px-4 py-2.5 text-sm">
            <span class="font-medium">{play.title}</span>
            <span class="font-mono text-[11px] text-muted-foreground"> · {play.artists ?? "Unknown"}</span>
          </li>
        {/each}
      </ul>
    </div>
  {/if}
</section>
