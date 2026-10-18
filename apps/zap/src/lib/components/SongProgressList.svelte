<script lang="ts">
  export type SongProgressView = {
    identityKey?: string;
    title?: string | null;
    phase: string;
    percent: number;
  };

  let {
    songs = [],
    sendingLabel = "Downloading",
  }: {
    songs?: SongProgressView[];
    /** Label used for the download/send phase (file upload uses “Sending”). */
    sendingLabel?: string;
  } = $props();

  function phaseLabel(phase: string) {
    if (phase === "downloading") return sendingLabel;
    if (phase === "uploading") return "Uploading";
    if (phase === "probing") return "Probing";
    if (phase === "finalizing") return "Finalizing";
    if (phase === "done") return "Done";
    if (phase === "unavailable") return "Saved · not available";
    if (phase === "skipped") return "Skipped";
    if (phase === "failed") return "Failed";
    return phase;
  }

  function barClass(phase: string) {
    if (phase === "failed") return "bg-destructive";
    if (phase === "skipped") return "bg-muted-foreground";
    if (phase === "unavailable") return "bg-accent";
    if (phase === "done") return "bg-signal";
    return "bg-signal";
  }
</script>

{#if songs.length > 0}
  <ul class="mt-2 space-y-2">
    {#each songs as song (song.identityKey ?? song.title ?? Math.random())}
      <li class="rounded border border-border/60 bg-background/40 px-2.5 py-2">
        <div class="flex items-center justify-between gap-2 font-mono text-[10px]">
          <span class="min-w-0 truncate text-foreground">{song.title || "Track"}</span>
          <span class="shrink-0 text-muted-foreground">
            {phaseLabel(song.phase)}
            {#if song.phase === "downloading" || song.phase === "uploading" || song.phase === "probing" || song.phase === "finalizing"}
              {song.percent}%
            {/if}
          </span>
        </div>
        <div class="mt-1.5 h-1 overflow-hidden rounded-full bg-border/80">
          <div
            class={`h-full transition-[width] duration-150 ${barClass(song.phase)}`}
            style={`width: ${Math.max(0, Math.min(100, song.percent))}%`}
          ></div>
        </div>
      </li>
    {/each}
  </ul>
{/if}
