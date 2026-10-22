<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import ZapSelect from "$lib/components/ZapSelect.svelte";
  import type { AdminActivityEntry } from "$lib/server/admin/activity-merge";
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

  let activity = $state<AdminActivityEntry[]>([]);
  let nextBefore = $state<string | null>(null);
  let loadingMore = $state(false);
  let listError = $state<string | null>(null);
  let scrollRoot = $state<HTMLDivElement | null>(null);
  let sentinel = $state<HTMLDivElement | null>(null);
  let fetchGen = 0;

  const hasMore = $derived(Boolean(nextBefore));

  $effect(() => {
    userFilter = data.filters.userId;
    kindFilter = data.filters.kind;
    activity = [...data.activity];
    nextBefore = data.nextBefore;
    listError = null;
    scrollRoot?.scrollTo({ top: 0 });
  });

  function applyFilters(next: { user?: string; kind?: string }) {
    const params = new URLSearchParams();
    const user = next.user ?? userFilter;
    const kind = next.kind ?? kindFilter;
    if (user) params.set("user", user);
    if (kind) params.set("kind", kind);
    const qs = params.toString();
    void goto(qs ? `${page.url.pathname}?${qs}` : page.url.pathname, { keepFocus: true, noScroll: true });
  }

  async function loadMore() {
    if (!nextBefore || loadingMore) return;
    const gen = ++fetchGen;
    const before = nextBefore;
    loadingMore = true;
    listError = null;
    try {
      const params = new URLSearchParams();
      params.set("before", before);
      if (userFilter) params.set("user", userFilter);
      if (kindFilter) params.set("kind", kindFilter);
      const res = await fetch(`/api/admin/activity?${params}`, {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error(`Failed to load activity (${res.status})`);
      const body = (await res.json()) as { entries: AdminActivityEntry[]; nextBefore: string | null };
      if (gen !== fetchGen) return;
      const seen = new Set(activity.map((e) => e.id));
      activity = [...activity, ...body.entries.filter((e) => !seen.has(e.id))];
      nextBefore = body.nextBefore;
    } catch (err) {
      if (gen !== fetchGen) return;
      listError = err instanceof Error ? err.message : "Failed to load activity";
    } finally {
      if (gen === fetchGen) loadingMore = false;
    }
  }

  $effect(() => {
    if (!sentinel || !scrollRoot) return;
    const el = sentinel;
    void activity.length;
    void hasMore;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && hasMore && !loadingMore) {
          void loadMore();
        }
      },
      { root: scrollRoot, rootMargin: "200px" }
    );
    io.observe(el);
    return () => io.disconnect();
  });

  function formatWhen(iso: string | null) {
    if (!iso) return "—";
    try {
      return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
    } catch {
      return iso;
    }
  }

  function isExternalHref(href: string) {
    return href.startsWith("http://") || href.startsWith("https://");
  }

  function linkAttrs(href: string) {
    return isExternalHref(href) ? { href, target: "_blank" as const, rel: "noopener noreferrer" } : { href };
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

<div class="flex min-h-0 flex-1 flex-col gap-4">
  <ul class="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4">
    {#each stats as stat (stat.label)}
      <li class="rounded-lg border border-border/70 bg-card/40 px-3 py-2">
        <p class="font-mono text-[10px] tracking-[0.12em] text-muted-foreground uppercase">{stat.label}</p>
        <p class="mt-1 text-xl font-semibold tabular-nums">{stat.value}</p>
      </li>
    {/each}
  </ul>

  <div class="flex min-h-0 flex-1 flex-col gap-3">
    <div class="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
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

    {#if listError}
      <p class="auth-error mb-0 shrink-0 p-2">{listError}</p>
    {/if}

    {#if activity.length === 0}
      <p class="rounded border border-dashed border-border/70 px-4 py-6 text-center text-sm text-muted-foreground">No activity for these filters.</p>
    {:else}
      <div bind:this={scrollRoot} class="zap-track-host min-h-0 flex-1 overflow-y-auto overscroll-contain" role="region" aria-label="Activity log">
        <ul class="divide-y divide-border/60">
          {#each activity as entry (entry.id)}
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
              <p class="mt-0.5 text-sm text-muted-foreground">
                {#if entry.kind === "play" && entry.href}
                  <a class="font-medium text-foreground hover:text-signal hover:underline" {...linkAttrs(entry.href)}>{entry.summary}</a>
                {:else if entry.kind === "import" && entry.links?.length}
                  <span>{entry.summary.startsWith("Playlist import") ? "Playlist import" : "URL import"}:</span>
                  {#each entry.links as link, i (link.href + link.label)}
                    {#if i > 0}<span>, </span>{/if}
                    <a class="text-signal hover:underline" {...linkAttrs(link.href)}>{link.label}</a>
                  {/each}
                {:else if entry.href}
                  <a class="text-signal hover:underline" {...linkAttrs(entry.href)}>{entry.summary}</a>
                {:else}
                  {entry.summary}
                {/if}
              </p>
              {#if entry.detail}
                <p class="mt-0.5 font-mono text-[11px] text-muted-foreground">{entry.detail}</p>
              {/if}
            </li>
          {/each}
        </ul>
        <div bind:this={sentinel} class="h-8" aria-hidden="true"></div>
        {#if loadingMore}
          <p class="px-4 pb-3 font-mono text-[10px] text-muted-foreground">Loading more…</p>
        {:else if !hasMore}
          <p class="px-4 pb-3 font-mono text-[10px] text-muted-foreground">End of activity</p>
        {/if}
      </div>
    {/if}
  </div>
</div>
