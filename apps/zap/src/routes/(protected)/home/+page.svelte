<script lang="ts">
  import Disc3Icon from "@lucide/svelte/icons/disc-3";
  import DoorOpenIcon from "@lucide/svelte/icons/door-open";
  import ListMusicIcon from "@lucide/svelte/icons/list-music";
  import RadioIcon from "@lucide/svelte/icons/radio";
  import ShieldIcon from "@lucide/svelte/icons/shield";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
</script>

<section class="zap-page">
  <PageHeader title="Home" />

  <div class="flex min-h-0 flex-1 flex-col gap-8 overflow-y-auto overscroll-contain">
    {#if data.liveSessions.length}
      <div class="rounded border-2 border-signal/40 bg-signal/10 px-4 py-4">
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
              <a
                href={`/session/${live.id}`}
                class="inline-flex items-center gap-1.5 rounded border border-border px-3 py-1.5 font-mono text-[10px] hover:bg-secondary/60"
              >
                <RadioIcon class="size-3.5" aria-hidden="true" />
                Resume
              </a>
            </li>
          {/each}
        </ul>
      </div>
    {/if}

    <div class="flex flex-wrap gap-3">
      <a
        href="/session?stay=1"
        class="inline-flex items-center gap-1.5 rounded bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        <RadioIcon class="size-4" aria-hidden="true" />
        Sessions
      </a>
      <a
        href="/join"
        class="inline-flex items-center gap-1.5 rounded border border-border bg-secondary/60 px-5 py-2.5 text-sm text-secondary-foreground hover:bg-secondary"
      >
        <DoorOpenIcon class="size-4" aria-hidden="true" />
        Join
      </a>
      <a
        href="/catalogue"
        class="inline-flex items-center gap-1.5 rounded border border-border px-5 py-2.5 text-sm text-muted-foreground hover:bg-secondary/40"
      >
        <Disc3Icon class="size-4" aria-hidden="true" />
        Catalogue
      </a>
      {#if data.isAdmin}
        <a
          href="/admin"
          class="inline-flex items-center gap-1.5 rounded border border-signal/40 bg-signal/10 px-5 py-2.5 text-sm text-signal hover:bg-signal/20"
        >
          <ShieldIcon class="size-4" aria-hidden="true" />
          Admin
        </a>
      {/if}
    </div>

    <div class="space-y-2">
      <div class="flex items-baseline justify-between gap-2">
        <h2 class="zap-section-label inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.18em] uppercase">
          <ListMusicIcon class="size-3.5" aria-hidden="true" />
          Playlists
        </h2>
        <a href="/playlists" class="font-mono text-[10px] text-signal hover:underline">
          {data.playlistCount > data.playlists.length ? `All ${data.playlistCount}` : "Manage"}
        </a>
      </div>
      {#if data.playlists.length === 0}
        <p class="rounded border border-dashed border-border/70 px-4 py-6 text-center text-sm text-muted-foreground">
          No playlists yet. <a href="/playlists" class="text-signal hover:underline">Create one</a>.
        </p>
      {:else}
        <ul class="zap-track-host divide-y divide-border/50">
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
          <h2 class="zap-section-label font-mono text-[10px] tracking-[0.18em] uppercase">Recent plays</h2>
          <a href="/history" class="font-mono text-[10px] text-signal hover:underline">History</a>
        </div>
        <ul class="zap-track-host divide-y divide-border/50">
          {#each data.playHistory as play (play.id)}
            <li class="px-4 py-2.5 text-sm">
              <span class="font-medium">{play.title}</span>
              <span class="font-mono text-[11px] text-muted-foreground"> · {play.artists ?? "Unknown"}</span>
            </li>
          {/each}
        </ul>
      </div>
    {/if}
  </div>
</section>
