<script lang="ts">
  import { replaceState } from "$app/navigation";
  import { page } from "$app/state";
  import CatalogueFilters from "$lib/components/CatalogueFilters.svelte";
  import ListBusyOverlay from "$lib/components/ListBusyOverlay.svelte";
  import TrackListSkeleton from "$lib/components/TrackListSkeleton.svelte";
  import TrackRow, { type TrackItem } from "$lib/components/TrackRow.svelte";
  import type { ActionData, PageData } from "./$types";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let scope = $state<"all" | "yours">("all");
  let q = $state("");
  let selected = $state<string[]>([]);
  let tagQuery = $state("");
  let tagQueryError = $state<string | null>(null);

  let assets = $state<TrackItem[]>([]);
  let hasMore = $state(false);
  let nextOffset = $state(0);
  let loading = $state(false);
  let loadingMore = $state(false);
  let listError = $state<string | null>(null);

  let activeId = $state<string | null>(null);
  let audioEl = $state<HTMLAudioElement | null>(null);
  let sentinel = $state<HTMLDivElement | null>(null);

  let fetchGen = 0;
  let hydratedKey = $state("");

  $effect(() => {
    const key = `${data.scope}|${data.q}|${data.tagQuery}|${data.selectedTagIds.join(",")}|${data.nextOffset}|${data.assets.map((a) => a.id).join(",")}`;
    if (key === hydratedKey) return;
    hydratedKey = key;
    scope = data.scope === "yours" ? "yours" : "all";
    q = data.q;
    tagQuery = data.tagQuery ?? "";
    tagQueryError = data.tagQueryError ?? null;
    selected = [...data.selectedTagIds];
    assets = data.assets.map((a) => ({ ...a, playable: Boolean(a.playable) }));
    hasMore = data.hasMore;
    nextOffset = data.nextOffset;
  });

  function buildParams(offset = 0) {
    const params = new URLSearchParams();
    if (scope === "yours") params.set("scope", "yours");
    if (q.trim()) params.set("q", q.trim());
    const tq = tagQuery.trim();
    if (tq) params.set("tq", tq);
    else for (const id of selected) params.append("tag", id);
    if (offset > 0) params.set("offset", String(offset));
    params.set("limit", String(data.pageSize));
    return params;
  }

  function updateUrl() {
    const params = new URLSearchParams();
    if (scope === "yours") params.set("scope", "yours");
    if (q.trim()) params.set("q", q.trim());
    const tq = tagQuery.trim();
    if (tq) params.set("tq", tq);
    else for (const id of selected) params.append("tag", id);
    const qs = params.toString();
    replaceState(qs ? `${page.url.pathname}?${qs}` : page.url.pathname, {});
  }

  async function fetchPage(opts: { reset: boolean }) {
    const gen = ++fetchGen;
    if (opts.reset) {
      loading = true;
      listError = null;
      tagQueryError = null;
    } else loadingMore = true;

    try {
      const offset = opts.reset ? 0 : nextOffset;
      const res = await fetch(`/api/catalogue?${buildParams(offset)}`, {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error(`Browse failed (${res.status})`);
      const body = (await res.json()) as {
        assets: TrackItem[];
        hasMore: boolean;
        nextOffset: number;
        tagQueryError?: string | null;
      };
      if (gen !== fetchGen) return;
      assets = opts.reset ? body.assets : [...assets, ...body.assets];
      hasMore = body.hasMore;
      nextOffset = body.nextOffset;
      tagQueryError = body.tagQueryError ?? null;
      if (opts.reset) updateUrl();
    } catch (err) {
      if (gen !== fetchGen) return;
      listError = err instanceof Error ? err.message : "Browse failed";
    } finally {
      if (gen === fetchGen) {
        loading = false;
        loadingMore = false;
      }
    }
  }

  $effect(() => {
    if (!sentinel) return;
    const el = sentinel;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && hasMore && !loading && !loadingMore) {
          void fetchPage({ reset: false });
        }
      },
      { rootMargin: "240px" }
    );
    io.observe(el);
    return () => io.disconnect();
  });
</script>

<audio bind:this={audioEl} preload="auto" class="hidden"></audio>

<section class="space-y-6">
  <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <h1 class="text-3xl font-semibold tracking-tight">Catalogue</h1>
      <p class="mt-1 text-sm text-muted-foreground">
        Search the shared Zap catalogue. <span class="font-mono text-signal">Your library</span> = tracks you’ve tagged.
        <a href="/add" class="text-signal hover:underline">Add music</a> to ingest.
      </p>
    </div>
  </div>

  {#if data.suggestions?.length}
    <div class="space-y-2">
      <h2 class="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">Suggested from others</h2>
      <ul class="divide-y divide-border/50 rounded-lg border border-border/70 bg-card/30">
        {#each data.suggestions as track (track.id)}
          <TrackRow {track} availableTags={data.availableTags} bind:activeId bind:audioEl />
        {/each}
      </ul>
    </div>
  {/if}

  <div class="rounded-lg border border-border/70 bg-card/50 p-4">
    <CatalogueFilters
      bind:scope
      bind:q
      bind:tagQuery
      bind:selectedTagIds={selected}
      availableTags={data.availableTags}
      {tagQueryError}
      busy={loading}
      onchange={() => void fetchPage({ reset: true })}
    />
  </div>

  {#if form?.tagError}
    <p class="auth-error">{form.tagError}</p>
  {/if}
  {#if form?.tagOk}
    <p class="text-sm text-signal">Tags updated.</p>
  {/if}
  {#if listError}
    <p class="auth-error">{listError}</p>
  {/if}

  {#if loading && assets.length === 0}
    <TrackListSkeleton rows={8} />
  {:else}
    <ListBusyOverlay busy={loading && assets.length > 0} label="Updating catalogue…">
      <ul class="divide-y divide-border/50 rounded-lg border border-border/70 bg-card/30 min-h-[12rem]">
        {#if assets.length === 0}
          <li class="px-4 py-10 text-center text-sm text-muted-foreground">
            No tracks match.
            <a href="/add" class="text-signal hover:underline">Add music</a>
            or clear filters.
          </li>
        {:else}
          {#each assets as track (track.id)}
            <TrackRow {track} availableTags={data.availableTags} bind:activeId bind:audioEl />
          {/each}
        {/if}
      </ul>
    </ListBusyOverlay>
  {/if}

  <div bind:this={sentinel} class="h-8" aria-hidden="true"></div>
  {#if loadingMore}
    <div class="flex justify-center py-1">
      <span class="inline-flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
        <span class="zap-busy-bars scale-90" aria-hidden="true"><span></span><span></span><span></span></span>
        Loading more…
      </span>
    </div>
  {:else if !hasMore && assets.length > 0}
    <p class="text-center font-mono text-[11px] text-muted-foreground">End of catalogue</p>
  {/if}
</section>
