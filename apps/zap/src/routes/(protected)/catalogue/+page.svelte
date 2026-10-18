<script lang="ts">
  import PlusIcon from "@lucide/svelte/icons/plus";
  import { onMount } from "svelte";
  import { afterNavigate, replaceState } from "$app/navigation";
  import { page } from "$app/state";
  import AddMusicDialog, { parseAddMusicTab, type AddMusicTab } from "$lib/components/AddMusicDialog.svelte";
  import CatalogueFilters from "$lib/components/CatalogueFilters.svelte";
  import ListBusyOverlay from "$lib/components/ListBusyOverlay.svelte";
  import TrackListSkeleton from "$lib/components/TrackListSkeleton.svelte";
  import TrackRow, { type TrackItem } from "$lib/components/TrackRow.svelte";
  import type { ActionData, PageData } from "./$types";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  const FILTERS_OPEN_KEY = "zap.catalogue.filtersOpen";

  let scope = $state<"all" | "yours">("all");
  let q = $state("");
  let selected = $state<string[]>([]);
  let tagQuery = $state("");
  let tagQueryError = $state<string | null>(null);
  let availableTags = $state<PageData["availableTags"]>([]);

  let assets = $state<TrackItem[]>([]);
  let hasMore = $state(false);
  let nextOffset = $state(0);
  let loading = $state(false);
  let loadingMore = $state(false);
  let listError = $state<string | null>(null);

  let activeId = $state<string | null>(null);
  let audioEl = $state<HTMLAudioElement | null>(null);
  let sentinel = $state<HTMLDivElement | null>(null);
  let scrollRoot = $state<HTMLDivElement | null>(null);

  let filtersOpen = $state(true);
  let filtersPrefLoaded = false;
  let addOpen = $state(false);
  let addTab = $state<AddMusicTab>("url");
  let addMessage = $state<string | null>(null);

  let fetchGen = 0;
  let hydratedKey = $state("");

  let deletedIds = $state<string[]>([]);
  let deleteMessage = $state<string | null>(null);
  const filtering = $derived(Boolean(q.trim() || tagQuery.trim() || selected.length));
  const suggestions = $derived(filtering ? [] : (data.suggestions ?? []).filter((t) => !deletedIds.includes(t.id)));

  function onDeleted(id: string, message: string) {
    deletedIds = [...deletedIds, id];
    assets = assets.filter((a) => a.id !== id);
    nextOffset = Math.max(nextOffset - 1, 0);
    deleteMessage = message;
  }

  $effect(() => {
    availableTags = data.availableTags;
  });

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

  onMount(() => {
    try {
      const stored = localStorage.getItem(FILTERS_OPEN_KEY);
      if (stored !== null) filtersOpen = stored === "1";
    } catch {
      // storage unavailable (private mode) — keep default
    }
    filtersPrefLoaded = true;
  });

  $effect(() => {
    const value = filtersOpen;
    if (!filtersPrefLoaded) return;
    try {
      localStorage.setItem(FILTERS_OPEN_KEY, value ? "1" : "0");
    } catch {
      // ignore
    }
  });

  /** `?add` / `?add=file|youtube` deep-links (legacy /add, YouTube OAuth return) open the add dialog. */
  afterNavigate(({ to }) => {
    const add = to?.url.searchParams.get("add");
    if (add == null || !to) return;
    openAdd(parseAddMusicTab(add));
    const cleaned = new URL(to.url);
    cleaned.searchParams.delete("add");
    // Runs before the router is marked started on first load; defer so replaceState is allowed.
    queueMicrotask(() => replaceState(`${cleaned.pathname}${cleaned.search}`, {}));
  });

  function openAdd(tab: AddMusicTab = addTab) {
    addTab = tab;
    addMessage = null;
    addOpen = true;
  }

  async function refreshTags() {
    try {
      const res = await fetch("/api/catalogue", { method: "POST", credentials: "same-origin", headers: { Accept: "application/json" } });
      if (!res.ok) return;
      const body = (await res.json()) as { availableTags?: PageData["availableTags"] };
      if (body.availableTags) availableTags = body.availableTags;
    } catch {
      // keep current tags; next full load refreshes them
    }
  }

  function onAdded(message: string) {
    addMessage = message;
    void fetchPage({ reset: true });
    void refreshTags();
  }

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
      if (opts.reset) {
        updateUrl();
        scrollRoot?.scrollTo({ top: 0 });
      }
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
    if (!sentinel || !scrollRoot) return;
    const el = sentinel;
    // Re-observe after each page so a short list that still shows the sentinel keeps loading.
    void assets.length;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && hasMore && !loading && !loadingMore) {
          void fetchPage({ reset: false });
        }
      },
      { root: scrollRoot, rootMargin: "240px" }
    );
    io.observe(el);
    return () => io.disconnect();
  });
</script>

<audio bind:this={audioEl} preload="auto" class="hidden"></audio>

{#snippet addButton()}
  <button
    type="button"
    class="inline-flex size-9 shrink-0 items-center justify-center rounded bg-primary text-primary-foreground hover:opacity-90"
    aria-label="Add music"
    title="Add music"
    onclick={() => openAdd()}
  >
    <PlusIcon class="size-5" />
  </button>
{/snippet}

<section class="flex min-h-0 flex-1 flex-col gap-3">
  <div class="shrink-0">
    <h1 class="text-2xl font-semibold tracking-tight sm:text-3xl">Catalogue</h1>
    <p class="mt-1 text-sm text-muted-foreground">
      Search the shared Zap catalogue. <span class="font-mono text-signal">Your library</span> = tracks you’ve tagged. Use
      <span class="font-mono text-signal">+</span> to add music.
    </p>
  </div>

  <div class="shrink-0 rounded-lg border border-border/70 bg-card/50 p-3">
    <CatalogueFilters
      collapsible
      bind:open={filtersOpen}
      bind:scope
      bind:q
      bind:tagQuery
      bind:selectedTagIds={selected}
      {availableTags}
      {tagQueryError}
      busy={loading}
      actions={addButton}
      onchange={() => void fetchPage({ reset: true })}
    />
  </div>

  {#if form?.tagError || form?.tagOk || listError || deleteMessage || addMessage}
    <div class="shrink-0 space-y-1">
      {#if form?.tagError}
        <p class="auth-error mb-0 p-2">{form.tagError}</p>
      {/if}
      {#if form?.tagOk}
        <p class="text-sm text-signal">Tags updated.</p>
      {/if}
      {#if listError}
        <p class="auth-error mb-0 p-2">{listError}</p>
      {/if}
      {#if deleteMessage}
        <p class="text-sm text-signal">{deleteMessage}</p>
      {/if}
      {#if addMessage}
        <p class="text-sm text-signal">{addMessage}</p>
      {/if}
    </div>
  {/if}

  <div class="min-h-[12rem] flex-1">
    {#if loading && assets.length === 0}
      <div class="h-full overflow-hidden">
        <TrackListSkeleton rows={8} />
      </div>
    {:else}
      <ListBusyOverlay fill busy={loading && assets.length > 0} label="Updating catalogue…">
        <div bind:this={scrollRoot} class="h-full overflow-y-auto overscroll-contain rounded-lg border border-border/70 bg-card/30">
          {#if suggestions.length}
            <h2 class="border-b border-border/50 px-4 pt-3 pb-2 font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
              Suggested from others
            </h2>
            <ul class="divide-y divide-border/50 border-b border-border/70">
              {#each suggestions as track (track.id)}
                <TrackRow {track} {availableTags} bind:activeId bind:audioEl canDelete={data.zapAdmin} ondeleted={onDeleted} />
              {/each}
            </ul>
            <h2 class="border-b border-border/50 px-4 pt-3 pb-2 font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
              {scope === "yours" ? "Your library" : "All tracks"}
            </h2>
          {/if}
          <ul class="divide-y divide-border/50">
            {#if assets.length === 0}
              <li class="px-4 py-10 text-center text-sm text-muted-foreground">
                No tracks match.
                <button type="button" class="text-signal hover:underline" onclick={() => openAdd()}>Add music</button>
                or clear filters.
              </li>
            {:else}
              {#each assets as track (track.id)}
                <TrackRow {track} {availableTags} bind:activeId bind:audioEl canDelete={data.zapAdmin} ondeleted={onDeleted} />
              {/each}
            {/if}
          </ul>

          <div bind:this={sentinel} class="h-px" aria-hidden="true"></div>
          {#if loadingMore}
            <div class="flex justify-center py-3">
              <span class="inline-flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
                <span class="zap-busy-bars scale-90" aria-hidden="true"><span></span><span></span><span></span></span>
                Loading more…
              </span>
            </div>
          {:else if !hasMore && assets.length > 0}
            <p class="border-t border-border/50 py-3 text-center font-mono text-[11px] text-muted-foreground">End of catalogue</p>
          {/if}
        </div>
      </ListBusyOverlay>
    {/if}
  </div>
</section>

<AddMusicDialog bind:open={addOpen} bind:tab={addTab} config={data.addMusic} {availableTags} onadded={onAdded} />
