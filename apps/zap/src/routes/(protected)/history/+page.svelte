<script lang="ts">
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  function formatWhen(iso: string) {
    try {
      return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
    } catch {
      return iso;
    }
  }

  function activityKindLabel(kind: string) {
    if (kind === "playlist_import") return "Playlist";
    if (kind === "url_import") return "URL";
    if (kind === "upload") return "Upload";
    return kind;
  }
</script>

<section class="space-y-8">
  <div>
    <h1 class="text-3xl font-semibold tracking-tight">History</h1>
    <p class="mt-1 text-sm text-muted-foreground">
      Plays and imports. Saved queues live under
      <a href="/playlists" class="text-signal hover:underline">Playlists</a>
      (separate from Zap playlists).
    </p>
  </div>

  <div class="space-y-3">
    <h2 class="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">Play history</h2>
    {#if !data.playHistory?.length}
      <p class="rounded border border-dashed border-border/70 px-4 py-6 text-center text-sm text-muted-foreground">
        Nothing played yet — start a session and hit play.
      </p>
    {:else}
      <ul class="divide-y divide-border/60 rounded-lg border border-border/70 bg-card/30">
        {#each data.playHistory as play (play.id)}
          <li class="px-4 py-3">
            <div class="flex flex-wrap items-baseline justify-between gap-2">
              <p class="text-sm font-medium">{play.title}</p>
              <time class="font-mono text-[11px] text-muted-foreground" datetime={play.at}>{formatWhen(play.at)}</time>
            </div>
            <p class="mt-0.5 font-mono text-[11px] text-muted-foreground">
              {play.artists ?? "Unknown"}
              {#if play.sessionId}
                · session{/if}
            </p>
          </li>
        {/each}
      </ul>
    {/if}
  </div>

  <div class="space-y-3">
    <h2 class="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">Uploads & imports</h2>
    {#if !data.activity?.length}
      <p class="rounded border border-dashed border-border/70 px-4 py-6 text-center text-sm text-muted-foreground">
        No imports yet —
        <a href="/catalogue?add" class="text-signal hover:underline">Add music</a>.
      </p>
    {:else}
      <ul class="divide-y divide-border/60 rounded-lg border border-border/70 bg-card/30">
        {#each data.activity as entry (entry.id)}
          <li class="px-4 py-3">
            <div class="flex flex-wrap items-baseline justify-between gap-2">
              <p class="font-mono text-[11px] text-signal">{activityKindLabel(entry.kind)}</p>
              <time class="font-mono text-[11px] text-muted-foreground" datetime={entry.at}>{formatWhen(entry.at)}</time>
            </div>
            <p class="mt-1 text-sm text-muted-foreground">
              {#if entry.kind === "upload"}
                {entry.title}
              {:else}
                {entry.label}
                · {entry.imported} imported
                {#if entry.unavailable}· {entry.unavailable} not available{/if}
                {#if entry.skipped}· {entry.skipped} skipped{/if}
                {#if entry.failed}· {entry.failed} failed{/if}
              {/if}
            </p>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</section>
