<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import ZapSelect from "$lib/components/ZapSelect.svelte";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  const kindOptions = [
    { value: "play", label: "Plays" },
    { value: "session_started", label: "Sessions started" },
    { value: "session_joined", label: "Session joins" },
    { value: "import", label: "Imports" },
    { value: "upload", label: "Uploads" },
  ];
  const kindLabels: Record<string, string> = {
    play: "Play",
    session_started: "Session",
    session_joined: "Join",
    import: "Import",
    upload: "Upload",
  };

  const userOptions = $derived(data.users.map((u) => ({ value: u.userId, label: u.label })));
  let userFilter = $state("");
  let kindFilter = $state("");
  $effect(() => {
    userFilter = data.filters.userId;
    kindFilter = data.filters.kind;
  });

  function applyFilters(next: { user?: string; kind?: string; before?: string }) {
    const params = new URLSearchParams();
    const user = next.user ?? userFilter;
    const kind = next.kind ?? kindFilter;
    if (user) params.set("user", user);
    if (kind) params.set("kind", kind);
    if (next.before) params.set("before", next.before);
    const qs = params.toString();
    void goto(qs ? `${page.url.pathname}?${qs}` : page.url.pathname, { keepFocus: true, noScroll: true });
  }

  function formatWhen(iso: string | null) {
    if (!iso) return "—";
    try {
      return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
    } catch {
      return iso;
    }
  }

  const stats = $derived([
    { label: "Seen in 24h", value: data.summary.activeDay },
    { label: "Seen in 7d", value: data.summary.activeWeek },
    { label: "Users seen", value: data.summary.usersSeen },
    { label: "Blocked", value: data.summary.blocked },
    { label: "Admins", value: data.summary.admins },
    { label: "Live sessions", value: data.summary.liveSessions },
    { label: "Songs", value: data.summary.songs },
    { label: "In storage", value: data.summary.storedSongs },
  ]);
</script>

<div class="space-y-6">
  <ul class="grid grid-cols-2 gap-2 sm:grid-cols-4">
    {#each stats as stat (stat.label)}
      <li class="rounded-lg border border-border/70 bg-card/40 px-3 py-2">
        <p class="font-mono text-[10px] tracking-[0.12em] text-muted-foreground uppercase">{stat.label}</p>
        <p class="mt-1 text-xl font-semibold tabular-nums">{stat.value}</p>
      </li>
    {/each}
  </ul>

  <div class="space-y-3">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 class="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">Activity</h2>
        <p class="mt-1 text-sm text-muted-foreground">Who used Zap and when — plays, sessions, joins, imports and uploads across all users.</p>
      </div>
      <div class="grid w-full gap-2 sm:w-auto sm:grid-cols-2">
        <div class="sm:w-48">
          <ZapSelect options={userOptions} bind:value={userFilter} placeholder="All users" onChange={(v) => applyFilters({ user: v })} />
        </div>
        <div class="sm:w-48">
          <ZapSelect options={kindOptions} bind:value={kindFilter} placeholder="All activity" onChange={(v) => applyFilters({ kind: v })} />
        </div>
      </div>
    </div>

    {#if data.activity.length === 0}
      <p class="rounded border border-dashed border-border/70 px-4 py-6 text-center text-sm text-muted-foreground">No activity for these filters.</p>
    {:else}
      <ul class="divide-y divide-border/60 rounded-lg border border-border/70 bg-card/30">
        {#each data.activity as entry (entry.id)}
          <li class="px-4 py-3">
            <div class="flex flex-wrap items-baseline justify-between gap-2">
              <p class="flex flex-wrap items-baseline gap-2 text-sm">
                <span class="font-mono text-[11px] text-signal">{kindLabels[entry.kind] ?? entry.kind}</span>
                <button
                  type="button"
                  class="font-medium text-foreground hover:text-signal hover:underline"
                  title="Show only this user"
                  onclick={() => applyFilters({ user: entry.userId })}>{entry.userLabel}</button
                >
              </p>
              <time class="font-mono text-[11px] text-muted-foreground" datetime={entry.at}>{formatWhen(entry.at)}</time>
            </div>
            <p class="mt-0.5 text-sm text-muted-foreground">{entry.summary}</p>
            {#if entry.detail}
              <p class="mt-0.5 font-mono text-[11px] text-muted-foreground">{entry.detail}</p>
            {/if}
          </li>
        {/each}
      </ul>
      <div class="flex justify-between font-mono text-[11px]">
        {#if data.filters.before}
          <button type="button" class="text-signal hover:underline" onclick={() => applyFilters({})}>← Newest</button>
        {:else}
          <span></span>
        {/if}
        {#if data.nextBefore}
          <button type="button" class="text-signal hover:underline" onclick={() => applyFilters({ before: data.nextBefore ?? undefined })}
            >Older →</button
          >
        {/if}
      </div>
    {/if}
  </div>
</div>
