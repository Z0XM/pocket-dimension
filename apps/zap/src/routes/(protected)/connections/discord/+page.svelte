<script lang="ts">
  import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";
  import HeadphonesIcon from "@lucide/svelte/icons/headphones";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  function when(iso: string) {
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  }
</script>

<section class="zap-page">
  <PageHeader title="Discord">
    {#snippet crumb()}
      <a href="/connections" class="inline-flex items-center gap-1 hover:text-signal">
        <ArrowLeftIcon class="size-3" aria-hidden="true" />
        Connections
      </a>
    {/snippet}
    {#snippet meta()}
      Session voice sink · bot output only
    {/snippet}
  </PageHeader>

  <div class="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain">
    <div class="space-y-3 border border-border/70 bg-card/30 p-4">
      <h2 class="font-mono text-xs tracking-[0.18em] text-muted-foreground uppercase">Details</h2>
      {#if !data.configured}
        <p class="text-sm text-muted-foreground">
          Discord bot is not configured. Set <span class="font-mono text-signal">DISCORD_BOT_TOKEN</span> and
          <span class="font-mono text-signal">DISCORD_CLIENT_ID</span>, then attach a voice channel from a live session Setup tab.
        </p>
      {:else}
        <p class="flex items-center gap-2 text-sm">
          <HeadphonesIcon class="size-4 text-signal" aria-hidden="true" />
          Bot ready
          {#if data.inviteUrl}
            <a class="font-mono text-[11px] text-signal hover:underline" href={data.inviteUrl} target="_blank" rel="noreferrer"
              >Invite bot</a
            >
          {/if}
        </p>
        {#if data.live.length}
          <ul class="space-y-2 font-mono text-[11px]">
            {#each data.live as row (row.sessionId)}
              <li class="border border-border/50 px-3 py-2">
                <span class={row.voiceConnected ? "text-signal" : "text-muted-foreground"}>
                  {row.voiceConnected ? "Connected" : "Disconnected"}
                </span>
                · {row.sink?.channelName ?? row.sink?.channelId ?? "voice"}
                <span class="text-muted-foreground"> in {row.sink?.guildName ?? row.sink?.guildId ?? "server"}</span>
                <a class="ml-2 text-signal hover:underline" href={`/session/${row.sessionId}`}>Open session</a>
              </li>
            {/each}
          </ul>
        {:else}
          <p class="font-mono text-[11px] text-muted-foreground">No active Discord sink on your live sessions. Attach from Setup.</p>
        {/if}
      {/if}
    </div>

    <div class="space-y-3">
      <h2 class="font-mono text-xs tracking-[0.18em] text-muted-foreground uppercase">Activity</h2>
      {#if data.activity.length === 0}
        <p class="font-mono text-[11px] text-muted-foreground">No Discord activity yet.</p>
      {:else}
        <ul class="divide-y divide-border/50 border border-border/70 bg-card/20">
          {#each data.activity as entry (entry.id)}
            <li class="px-3 py-2.5">
              <p class="text-sm text-foreground">{entry.summary}</p>
              <p class="mt-0.5 font-mono text-[10px] text-muted-foreground">
                {entry.kind} · {when(entry.at)}
              </p>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  </div>
</section>
