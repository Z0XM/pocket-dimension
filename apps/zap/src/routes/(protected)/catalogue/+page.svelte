<script lang="ts">
  import ListEndIcon from "@lucide/svelte/icons/list-end";
  import ListPlusIcon from "@lucide/svelte/icons/list-plus";
  import PlayIcon from "@lucide/svelte/icons/play";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import { onMount } from "svelte";
  import { afterNavigate, replaceState } from "$app/navigation";
  import { page } from "$app/state";
  import AddMusicDialog, { parseAddMusicTab, type AddMusicTab } from "$lib/components/AddMusicDialog.svelte";
  import CatalogueFilters from "$lib/components/CatalogueFilters.svelte";
  import ListBusyOverlay from "$lib/components/ListBusyOverlay.svelte";
  import SaveTagPlaylistDialog from "$lib/components/SaveTagPlaylistDialog.svelte";
  import TrackListSkeleton from "$lib/components/TrackListSkeleton.svelte";
  import TrackRow, { type TrackItem } from "$lib/components/TrackRow.svelte";
  import { getCatalogQueue, type CatalogueFilterInput } from "$lib/catalog-queue-client.svelte";
  import { withoutPlaylistScope } from "$lib/catalogue-scope";
  import { effectiveTagQuery, findPlaylistMatchingTagFilter, tagFilterKey } from "$lib/tag-filter";
  import type { ActionData, PageData } from "./$types";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  const FILTERS_OPEN_KEY = "zap.catalogue.filtersOpen";
  const queue = getCatalogQueue();

  function scopeFromData() {
    return data.scope === "playlist" && data.playlistId ? `playlist:${data.playlistId}` : data.scope === "all" ? "all" : "";
  }

  /** `""` = Your library (default), `all`, or `playlist:<id>`. */
  let libraryScope = $state(scopeFromData());
  let q = $state("");
  let selected = $state<string[]>([]);
  let tagQuery = $state("");
  let tagQueryError = $state<string | null>(null);
  let availableTags = $state<PageData["availableTags"]>([]);
  let topTagIds = $state<string[]>([]);
  let tagPlaylists = $state<PageData["tagPlaylists"]>([]);
  let savePlaylistOpen = $state(false);
  let savedPlaylistMessage = $state<string | null>(null);

  let assets = $state<TrackItem[]>([]);
  let hasMore = $state(false);
  let nextOffset = $state(0);
  let loading = $state(false);
  let loadingMore = $state(false);
  let listError = $state<string | null>(null);

  let bulkBusy = $state(false);
  let bulkError = $state<string | null>(null);
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
  const MISSING_PLAYLIST_NOTICE = "That playlist is no longer available — showing your library.";
  /** Playlists that 404'd since the page loaded (deleted elsewhere); hidden from the scope + “Add to playlist” menus. */
  let missingPlaylistIds = $state<string[]>([]);
  let scopeNotice = $state<string | null>(null);
  const filtering = $derived(Boolean(q.trim() || tagQuery.trim() || selected.length));
  const scopedPlaylistId = $derived(libraryScope.startsWith("playlist:") ? libraryScope.slice("playlist:".length) : null);
  const suggestions = $derived(filtering || scopedPlaylistId ? [] : (data.suggestions ?? []).filter((t) => !deletedIds.includes(t.id)));
  const playlistOptions = $derived((data.playlistOptions ?? []).filter((p) => !missingPlaylistIds.includes(p.id)));
  const scopeOptions = $derived.by(() => {
    const opts = [{ value: "all", label: "All tracks" }, ...playlistOptions.map((p) => ({ value: `playlist:${p.id}`, label: `▸ ${p.name}` }))];
    if (scopedPlaylistId && !opts.some((o) => o.value === libraryScope)) opts.push({ value: libraryScope, label: "▸ Shared playlist" });
    return opts;
  });
  const scopeLabel = $derived(scopeOptions.find((o) => o.value === libraryScope)?.label.replace(/^▸ /, "") ?? "Your library");
  const editablePlaylists = $derived(playlistOptions.filter((p) => p.canEdit).map((p) => ({ id: p.id, name: p.name })));
  const canAddAll = $derived(Boolean(queue) && (filtering || Boolean(scopedPlaylistId)) && assets.length > 0 && !tagQueryError);

  function filterInput(): CatalogueFilterInput {
    const tq = tagQuery.trim();
    return {
      scope: scopedPlaylistId ? "playlist" : libraryScope === "all" ? "all" : "yours",
      playlistId: scopedPlaylistId,
      q: q.trim(),
      tagQuery: tq,
      tagIds: tq ? [] : selected,
    };
  }

  async function addAllFiltered(mode: "replace" | "last") {
    if (!queue || bulkBusy) return;
    bulkBusy = true;
    bulkError = null;
    await queue.enqueueFiltered(filterInput(), mode);
    bulkError = queue.error;
    bulkBusy = false;
  }

  function onDeleted(id: string, message: string) {
    deletedIds = [...deletedIds, id];
    assets = assets.filter((a) => a.id !== id);
    nextOffset = Math.max(nextOffset - 1, 0);
    deleteMessage = message;
  }

  $effect(() => {
    availableTags = data.availableTags;
    topTagIds = data.topTagIds;
    tagPlaylists = data.tagPlaylists;
  });

  /** Tag filters only — the free-text search is deliberately ignored for playlist matching. */
  const tagFilter = $derived({ tagQuery, tagIds: selected });
  const tagFilterValid = $derived(!tagQueryError && tagFilterKey(tagFilter, availableTags) !== null);
  const matchingPlaylist = $derived(
    tagFilterValid
      ? findPlaylistMatchingTagFilter(
          tagFilter,
          tagPlaylists.filter((p) => !missingPlaylistIds.includes(p.id)),
          availableTags
        )
      : null
  );
  const saveTagQuery = $derived(effectiveTagQuery(tagFilter, availableTags));
  const savePlaylistDefaultName = $derived(
    tagQuery.trim()
      ? tagQuery.trim()
      : availableTags
          .filter((t) => selected.includes(t.id))
          .map((t) => t.name)
          .join(" + ")
  );

  function onPlaylistSaved(playlist: { id: string; name: string; tagQuery: string | null; trackCount: number }) {
    tagPlaylists = [...tagPlaylists, { id: playlist.id, name: playlist.name, tagQuery: playlist.tagQuery }];
    savedPlaylistMessage = `Saved playlist “${playlist.name}” (${playlist.trackCount} track${playlist.trackCount === 1 ? "" : "s"}).`;
  }

  $effect(() => {
    const key = `${data.scope}|${data.playlistId}|${data.playlistMissing}|${data.q}|${data.tagQuery}|${data.selectedTagIds.join(",")}|${data.nextOffset}|${data.assets.map((a) => a.id).join(",")}`;
    if (key === hydratedKey) return;
    hydratedKey = key;
    libraryScope = scopeFromData();
    scopeNotice = data.playlistMissing ? MISSING_PLAYLIST_NOTICE : null;
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

  /**
   * `?add` / `?add=file|youtube` deep-links (legacy /add, YouTube OAuth return) open the add dialog.
   * A `?playlist=` the server could not resolve (deleted) is dropped from the URL.
   */
  afterNavigate(({ to }) => {
    if (!to) return;
    const add = to.url.searchParams.get("add");
    const dropPlaylist = data.playlistMissing && to.url.searchParams.has("playlist");
    if (add == null && !dropPlaylist) return;
    if (add != null) openAdd(parseAddMusicTab(add));
    const cleaned = new URL(to.url);
    cleaned.searchParams.delete("add");
    const target = dropPlaylist ? withoutPlaylistScope(cleaned) : `${cleaned.pathname}${cleaned.search}`;
    // Runs before the router is marked started on first load; defer so replaceState is allowed.
    queueMicrotask(() => replaceState(target, {}));
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
      const body = (await res.json()) as { availableTags?: PageData["availableTags"]; topTagIds?: string[] };
      if (body.availableTags) availableTags = body.availableTags;
      if (body.topTagIds) topTagIds = body.topTagIds;
    } catch {
      // keep current tags; next full load refreshes them
    }
  }

  function onAdded(message: string) {
    addMessage = message;
    void fetchPage({ reset: true });
    void refreshTags();
  }

  function setScopeParams(params: URLSearchParams, forApi: boolean) {
    if (scopedPlaylistId) params.set("playlist", scopedPlaylistId);
    else if (libraryScope === "all") params.set("scope", "all");
    else if (forApi) params.set("scope", "yours");
  }

  function buildParams(offset = 0) {
    const params = new URLSearchParams();
    setScopeParams(params, true);
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
    setScopeParams(params, false);
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
      const requestedPlaylistId = scopedPlaylistId;
      const res = await fetch(`/api/catalogue?${buildParams(offset)}`, {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      if (res.status === 404 && requestedPlaylistId) {
        if (gen !== fetchGen) return;
        missingPlaylistIds = [...missingPlaylistIds, requestedPlaylistId];
        libraryScope = "";
        scopeNotice = MISSING_PLAYLIST_NOTICE;
        void fetchPage({ reset: true });
        return;
      }
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

<section class="zap-catalogue flex min-h-0 flex-1 flex-col gap-3">
  <div class="zap-catalogue-header shrink-0">
    <h1 class="zap-catalogue-title text-2xl font-semibold tracking-tight sm:text-3xl">Catalogue</h1>
    <p class="zap-catalogue-lede mt-1 text-sm text-muted-foreground">
      Search the shared Zap catalogue. <span class="font-mono text-signal">Your library</span> = tracks you’ve tagged. Play adds to your personal
      queue; use <span class="font-mono text-signal">+</span> to add music.
    </p>
  </div>

  <div class="zap-filters-panel shrink-0 rounded-lg border border-border/70 bg-card/50 p-3">
    <CatalogueFilters
      collapsible
      bind:open={filtersOpen}
      bind:libraryScope
      libraryScopeOptions={scopeOptions}
      bind:q
      bind:tagQuery
      bind:selectedTagIds={selected}
      {availableTags}
      {topTagIds}
      {tagQueryError}
      busy={loading}
      actions={addButton}
      onchange={() => {
        savedPlaylistMessage = null;
        scopeNotice = null;
        void fetchPage({ reset: true });
      }}
    />
    {#if tagFilterValid}
      <div class="mt-2 flex min-h-7 flex-wrap items-center gap-2 border-t border-border/50 pt-2 font-mono text-[11px] text-muted-foreground">
        {#if matchingPlaylist}
          <span>
            Matches playlist:
            <a href={`/playlists/${matchingPlaylist.id}`} class="text-signal hover:underline">{matchingPlaylist.name}</a>
          </span>
        {:else}
          <span>No playlist uses these tags.</span>
          <button
            type="button"
            class="inline-flex items-center gap-1 rounded border border-signal/40 px-2 py-0.5 text-[11px] text-signal hover:bg-signal/10"
            onclick={() => (savePlaylistOpen = true)}
          >
            <ListPlusIcon class="size-3.5" aria-hidden="true" />
            Save as playlist
          </button>
        {/if}
      </div>
    {/if}
    {#if canAddAll}
      <div class="mt-2 flex flex-wrap items-center gap-2 border-t border-border/50 pt-2 font-mono text-[11px] text-muted-foreground">
        <span>Add all {filtering ? "filtered" : scopeLabel} tracks{hasMore ? "" : ` (${assets.length})`}:</span>
        <button
          type="button"
          class="inline-flex items-center gap-1 rounded border border-signal/40 bg-signal/10 px-2 py-0.5 text-[11px] text-signal hover:bg-signal/20 disabled:opacity-40"
          disabled={bulkBusy}
          title="Replace your queue with these tracks and play"
          onclick={() => void addAllFiltered("replace")}
        >
          <PlayIcon class="size-3.5" aria-hidden="true" /> Play all
        </button>
        <button
          type="button"
          class="inline-flex items-center gap-1 rounded border border-border px-2 py-0.5 text-[11px] hover:text-signal disabled:opacity-40"
          disabled={bulkBusy}
          title="Append these tracks to the end of your queue"
          onclick={() => void addAllFiltered("last")}
        >
          <ListEndIcon class="size-3.5" aria-hidden="true" /> Add all to queue
        </button>
        {#if bulkError}<span class="text-destructive">{bulkError}</span>{/if}
      </div>
    {/if}
  </div>

  <div class="zap-catalogue-list-col flex min-h-0 min-w-0 flex-1 flex-col gap-3">
    {#if form?.tagError || form?.tagOk || listError || deleteMessage || addMessage || savedPlaylistMessage || scopeNotice}
      <div class="shrink-0 space-y-1">
        {#if scopeNotice}
          <p class="text-sm text-muted-foreground">{scopeNotice}</p>
        {/if}
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
        {#if savedPlaylistMessage}
          <p class="text-sm text-signal">{savedPlaylistMessage}</p>
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
          <div bind:this={scrollRoot} class="zap-track-host h-full overflow-y-auto overscroll-contain">
            {#if suggestions.length}
              <h2
                class="zap-section-label border-b border-border/50 px-4 pt-3 pb-2 font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase"
              >
                Suggested from others
              </h2>
              <ul class="zap-track-list zap-suggestions divide-y divide-border/50 border-b border-border/70">
                {#each suggestions as track (track.id)}
                  <TrackRow {track} {availableTags} {queue} playlists={editablePlaylists} canDelete={data.zapAdmin} ondeleted={onDeleted} />
                {/each}
              </ul>
              <h2
                class="zap-section-label border-b border-border/50 px-4 pt-3 pb-2 font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase"
              >
                {scopeLabel}
              </h2>
            {/if}
            <ul class="zap-track-list divide-y divide-border/50">
              {#if assets.length === 0}
                <li class="px-4 py-10 text-center text-sm text-muted-foreground">
                  {#if libraryScope === "" && !filtering}
                    Your library is empty — tag tracks to collect them here, or
                    <button
                      type="button"
                      class="text-signal hover:underline"
                      onclick={() => {
                        libraryScope = "all";
                        void fetchPage({ reset: true });
                      }}>browse all tracks</button
                    >.
                  {:else}
                    No tracks match.
                    <button type="button" class="text-signal hover:underline" onclick={() => openAdd()}>Add music</button>
                    or clear filters.
                  {/if}
                </li>
              {:else}
                {#each assets as track (track.id)}
                  <TrackRow {track} {availableTags} {queue} playlists={editablePlaylists} canDelete={data.zapAdmin} ondeleted={onDeleted} />
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
  </div>
</section>

<SaveTagPlaylistDialog bind:open={savePlaylistOpen} tagQuery={saveTagQuery} defaultName={savePlaylistDefaultName} onsaved={onPlaylistSaved} />
<AddMusicDialog bind:open={addOpen} bind:tab={addTab} config={data.addMusic} {availableTags} onadded={onAdded} />
