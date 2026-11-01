<script lang="ts">
  import SearchIcon from "@lucide/svelte/icons/search";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import ZapSelect from "$lib/components/ZapSelect.svelte";
  import { toast } from "$lib/toast.svelte";
  import { HISTORY_TIME_RANGE_OPTIONS } from "$lib/history-time";
  import type { LibraryActivityEntry } from "$lib/server/activity";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  const rangeOptions = HISTORY_TIME_RANGE_OPTIONS.map((o) => ({ value: o.value, label: o.label }));

  let q = $state("");
  let range = $state("all");
  let entries = $state<LibraryActivityEntry[]>([]);
  let nextBefore = $state<string | null>(null);
  let loadingMore = $state(false);
  let scrollRoot = $state<HTMLDivElement | null>(null);
  let sentinel = $state<HTMLDivElement | null>(null);
  let fetchGen = 0;

  const hasMore = $derived(Boolean(nextBefore));

  $effect(() => {
    q = data.filters.q;
    range = data.filters.range;
    entries = [...data.entries];
    nextBefore = data.nextBefore;
    scrollRoot?.scrollTo({ top: 0 });
  });

  function navigate(next: { q?: string; range?: string }) {
    const params = new URLSearchParams();
    const nq = (next.q ?? q).trim();
    const nr = next.range ?? range;
    if (nq) params.set("q", nq);
    if (nr && nr !== "all") params.set("range", nr);
    const qs = params.toString();
    void goto(qs ? `${page.url.pathname}?${qs}` : page.url.pathname, { keepFocus: true, noScroll: true });
  }

  async function loadMore() {
    if (!nextBefore || loadingMore) return;
    const gen = ++fetchGen;
    const before = nextBefore;
    loadingMore = true;
    try {
      const params = new URLSearchParams();
      params.set("before", before);
      if (q.trim()) params.set("q", q.trim());
      if (range && range !== "all") params.set("range", range);
      const res = await fetch(`/api/history/uploads?${params}`, {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error(`Failed to load uploads (${res.status})`);
      const body = (await res.json()) as { entries: LibraryActivityEntry[]; nextBefore: string | null };
      if (gen !== fetchGen) return;
      const seen = new Set(entries.map((e) => e.id));
      entries = [...entries, ...body.entries.filter((e) => !seen.has(e.id))];
      nextBefore = body.nextBefore;
    } catch (err) {
      if (gen !== fetchGen) return;
      toast.error(err instanceof Error ? err.message : "Failed to load uploads");
    } finally {
      if (gen === fetchGen) loadingMore = false;
    }
  }

  $effect(() => {
    if (!sentinel || !scrollRoot) return;
    const el = sentinel;
    void entries.length;
    void hasMore;
    const io = new IntersectionObserver(
      (obs) => {
        if (obs.some((e) => e.isIntersecting) && hasMore && !loadingMore) {
          void loadMore();
        }
      },
      { root: scrollRoot, rootMargin: "200px" }
    );
    io.observe(el);
    return () => io.disconnect();
  });

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

  function isExternalHref(href: string) {
    return href.startsWith("http://") || href.startsWith("https://");
  }

  function linkAttrs(href: string) {
    return isExternalHref(href) ? { href, target: "_blank" as const, rel: "noopener noreferrer" } : { href };
  }
</script>

<div class="flex min-h-0 flex-1 flex-col gap-3">
  <form
    class="grid shrink-0 gap-2 sm:grid-cols-[minmax(0,1fr)_12rem_auto]"
    onsubmit={(e) => {
      e.preventDefault();
      navigate({ q });
    }}
  >
    <div class="relative min-w-0">
      <SearchIcon class="pointer-events-none absolute top-1/2 left-2.5 size-4 shrink-0 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <input
        class="auth-field w-full pl-9"
        type="search"
        placeholder="Title, playlist or source URL"
        aria-label="Search uploads and imports"
        bind:value={q}
        autocomplete="off"
      />
    </div>
    <div class="min-w-0">
      <ZapSelect options={rangeOptions} bind:value={range} placeholder="All time" onChange={(v) => navigate({ range: v })} />
    </div>
    <button type="submit" class="auth-btn inline-flex h-auto min-h-10 w-fit shrink-0 items-center justify-center gap-1.5 whitespace-nowrap px-4 py-2">
      <SearchIcon class="size-3.5 shrink-0" aria-hidden="true" />
      Search
    </button>
  </form>

  {#if entries.length === 0}
    <p class="rounded border border-dashed border-border/70 px-4 py-6 text-center text-sm text-muted-foreground">
      {#if data.filters.q || data.filters.range !== "all"}
        No uploads or imports match these filters.
      {:else}
        No imports yet — <a href="/catalogue?add" class="text-signal hover:underline">Add music</a>.
      {/if}
    </p>
  {:else}
    <div
      bind:this={scrollRoot}
      class="zap-track-host min-h-0 flex-1 overflow-y-auto overscroll-contain"
      role="region"
      aria-label="Uploads and imports"
    >
      <ul class="divide-y divide-border/60">
        {#each entries as entry (entry.id)}
          <li class="px-4 py-3">
            <div class="flex flex-wrap items-baseline justify-between gap-2">
              <p class="font-mono text-[11px] text-signal">{activityKindLabel(entry.kind)}</p>
              <time class="font-mono text-[11px] text-muted-foreground" datetime={entry.at}>{formatWhen(entry.at)}</time>
            </div>
            <p class="mt-1 text-sm text-muted-foreground">
              {#if entry.kind === "upload"}
                <a class="font-medium text-foreground hover:text-signal hover:underline" {...linkAttrs(entry.href)}>{entry.title}</a>
              {:else if entry.links?.length}
                {#each entry.links as link, i (link.href + link.label)}
                  {#if i > 0}<span>, </span>{/if}
                  <a class="text-signal hover:underline" {...linkAttrs(link.href)}>{link.label}</a>
                {/each}
                <span>
                  · {entry.imported} imported
                  {#if entry.unavailable}· {entry.unavailable} not available{/if}
                  {#if entry.skipped}· {entry.skipped} skipped{/if}
                  {#if entry.failed}· {entry.failed} failed{/if}
                </span>
              {:else if entry.href}
                <a class="text-signal hover:underline" {...linkAttrs(entry.href)}>{entry.label}</a>
                <span>
                  · {entry.imported} imported
                  {#if entry.unavailable}· {entry.unavailable} not available{/if}
                  {#if entry.skipped}· {entry.skipped} skipped{/if}
                  {#if entry.failed}· {entry.failed} failed{/if}
                </span>
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
      <div bind:this={sentinel} class="h-8" aria-hidden="true"></div>
      {#if loadingMore}
        <p class="px-4 pb-3 font-mono text-[10px] text-muted-foreground">Loading more…</p>
      {:else if !hasMore}
        <p class="px-4 pb-3 font-mono text-[10px] text-muted-foreground">End of uploads and imports</p>
      {/if}
    </div>
  {/if}
</div>
