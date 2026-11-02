<script lang="ts">
  import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
  import ListEndIcon from "@lucide/svelte/icons/list-end";
  import ListPlusIcon from "@lucide/svelte/icons/list-plus";
  import ListStartIcon from "@lucide/svelte/icons/list-start";
  import PlayIcon from "@lucide/svelte/icons/play";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import ReplaceIcon from "@lucide/svelte/icons/replace";
  import ShuffleIcon from "@lucide/svelte/icons/shuffle";
  import { afterNavigate, replaceState } from "$app/navigation";
  import { page } from "$app/state";
  import AddMusicDialog, { parseAddMusicTab, type AddMusicTab } from "$lib/components/AddMusicDialog.svelte";
  import CatalogueFilters from "$lib/components/CatalogueFilters.svelte";
  import ListBusyOverlay from "$lib/components/ListBusyOverlay.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import SaveTagPlaylistDialog from "$lib/components/SaveTagPlaylistDialog.svelte";
  import TrackListSkeleton from "$lib/components/TrackListSkeleton.svelte";
  import TrackRow, { type TrackItem } from "$lib/components/TrackRow.svelte";
  import type { BulkEnqueueMode } from "$lib/catalog-queue";
  import { getCatalogQueue, type CatalogueFilterInput } from "$lib/catalog-queue-client.svelte";
  import { withoutPlaylistScope } from "$lib/catalogue-scope";
  import { effectiveTagQuery, findPlaylistMatchingTagFilter, tagFilterKey } from "$lib/tag-filter";
  import { toast } from "$lib/toast.svelte";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  const queue = getCatalogQueue();

  function scopeFromData() {
    return data.scope === "playlist" && data.playlistId ? `playlist:${data.playlistId}` : data.scope === "all" ? "all" : "";
  }

  /** `""` = Your library (default), `all`, or `playlist:<id>`. */
  let libraryScope = $state(scopeFromData());
  let q = $state("");
  let selected = $state<string[]>([]);
  let untagged = $state(false);
  let tagQuery = $state("");
  let tagQueryError = $state<string | null>(null);
  let availableTags = $state<PageData["availableTags"]>([]);
  let topTagIds = $state<string[]>([]);
  let tagPlaylists = $state<PageData["tagPlaylists"]>([]);
  let savePlaylistOpen = $state(false);

  let assets = $state<TrackItem[]>([]);
  let hasMore = $state(false);
  let nextOffset = $state(0);
  let loading = $state(false);
  let loadingMore = $state(false);

  let bulkBusy = $state(false);
  let playAllOpen = $state(false);
  let playAllTrigger = $state<HTMLButtonElement | null>(null);
  let playAllPanel = $state<HTMLDivElement | null>(null);
  let sentinel = $state<HTMLDivElement | null>(null);
  let scrollRoot = $state<HTMLDivElement | null>(null);

  let filtersOpen = $state(false);
  let addOpen = $state(false);
  let addTab = $state<AddMusicTab>("url");

  let fetchGen = 0;
  let hydratedKey = $state("");

  /** Tag edits on suggestion rows (those come from `data`, not the mutable `assets` list). */
  let suggestionTagsById = $state<Record<string, TrackItem["tags"]>>({});
  const MISSING_PLAYLIST_NOTICE = "That playlist is no longer available — showing your library.";
  /** Playlists that 404'd since the page loaded (deleted elsewhere); hidden from the scope + “Add to playlist” menus. */
  let missingPlaylistIds = $state<string[]>([]);
  const filtering = $derived(Boolean(q.trim() || tagQuery.trim() || selected.length || untagged));
  const scopedPlaylistId = $derived(libraryScope.startsWith("playlist:") ? libraryScope.slice("playlist:".length) : null);
  const suggestions = $derived(
    filtering || scopedPlaylistId
      ? []
      : (data.suggestions ?? []).map((t) => (suggestionTagsById[t.id] ? { ...t, tags: suggestionTagsById[t.id]! } : t))
  );
  const playlistOptions = $derived((data.playlistOptions ?? []).filter((p) => !missingPlaylistIds.includes(p.id)));
  const scopeOptions = $derived.by(() => {
    const opts = [{ value: "all", label: "All tracks" }, ...playlistOptions.map((p) => ({ value: `playlist:${p.id}`, label: `▸ ${p.name}` }))];
    if (scopedPlaylistId && !opts.some((o) => o.value === libraryScope)) opts.push({ value: libraryScope, label: "▸ Shared playlist" });
    return opts;
  });
  const scopeLabel = $derived(scopeOptions.find((o) => o.value === libraryScope)?.label.replace(/^▸ /, "") ?? "Your Library");
  const editablePlaylists = $derived(playlistOptions.filter((p) => p.canEdit).map((p) => ({ id: p.id, name: p.name })));
  const canPlayAll = $derived(Boolean(queue) && assets.length > 0 && !tagQueryError);

  function filterInput(): CatalogueFilterInput {
    const tq = untagged ? "" : tagQuery.trim();
    return {
      scope: scopedPlaylistId ? "playlist" : libraryScope === "all" ? "all" : "yours",
      playlistId: scopedPlaylistId,
      q: q.trim(),
      untagged,
      tagQuery: tq,
      tagIds: untagged || tq ? [] : selected,
    };
  }

  async function playAll(mode: BulkEnqueueMode) {
    if (!queue || bulkBusy || !canPlayAll) return;
    playAllOpen = false;
    bulkBusy = true;
    await queue.enqueueFiltered(filterInput(), mode);
    bulkBusy = false;
  }

  function onPlayAllClick() {
    if (!canPlayAll || bulkBusy) return;
    if (!filtering) {
      void playAll("last");
      return;
    }
    filtersOpen = false;
    playAllOpen = !playAllOpen;
  }

  $effect(() => {
    if (filtersOpen) playAllOpen = false;
  });

  function onPlayAllPointerDown(e: PointerEvent) {
    if (!playAllOpen || !(e.target instanceof Node)) return;
    if (playAllTrigger?.contains(e.target) || playAllPanel?.contains(e.target)) return;
    playAllOpen = false;
  }

  function onPlayAllKeydown(e: KeyboardEvent) {
    if (e.key === "Escape" && playAllOpen) {
      e.preventDefault();
      playAllOpen = false;
    }
  }

  function onTagsSaved(id: string, tags: TrackItem["tags"]) {
    assets = assets.map((a) => (a.id === id ? { ...a, tags } : a));
    if ((data.suggestions ?? []).some((t) => t.id === id)) {
      suggestionTagsById = { ...suggestionTagsById, [id]: tags };
    }
    void refreshTags();
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
    toast.success(`Saved playlist “${playlist.name}” (${playlist.trackCount} track${playlist.trackCount === 1 ? "" : "s"}).`);
  }

  $effect(() => {
    const key = `${data.scope}|${data.playlistId}|${data.playlistMissing}|${data.q}|${data.untagged}|${data.tagQuery}|${data.selectedTagIds.join(",")}|${data.nextOffset}|${data.assets.map((a) => a.id).join(",")}`;
    if (key === hydratedKey) return;
    hydratedKey = key;
    libraryScope = scopeFromData();
    if (data.playlistMissing) toast.info(MISSING_PLAYLIST_NOTICE);
    q = data.q;
    untagged = Boolean(data.untagged);
    tagQuery = data.tagQuery ?? "";
    tagQueryError = data.tagQueryError ?? null;
    selected = [...data.selectedTagIds];
    assets = data.assets.map((a) => ({ ...a, playable: Boolean(a.playable) }));
    hasMore = data.hasMore;
    nextOffset = data.nextOffset;
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
    toast.success(message);
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
    if (untagged) params.set("untagged", "1");
    else {
      const tq = tagQuery.trim();
      if (tq) params.set("tq", tq);
      else for (const id of selected) params.append("tag", id);
    }
    if (offset > 0) params.set("offset", String(offset));
    params.set("limit", String(data.pageSize));
    return params;
  }

  function updateUrl() {
    const params = new URLSearchParams();
    setScopeParams(params, false);
    if (q.trim()) params.set("q", q.trim());
    if (untagged) params.set("untagged", "1");
    else {
      const tq = tagQuery.trim();
      if (tq) params.set("tq", tq);
      else for (const id of selected) params.append("tag", id);
    }
    const qs = params.toString();
    replaceState(qs ? `${page.url.pathname}?${qs}` : page.url.pathname, {});
  }

  async function fetchPage(opts: { reset: boolean }) {
    const gen = ++fetchGen;
    if (opts.reset) {
      loading = true;
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
        toast.info(MISSING_PLAYLIST_NOTICE);
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
      toast.error(err instanceof Error ? err.message : "Browse failed");
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

{#snippet catalogueToolbarExtras()}
  <div class="relative inline-flex shrink-0 items-center gap-3">
    <button
      type="button"
      bind:this={playAllTrigger}
      class={`inline-flex max-w-full shrink-0 items-center gap-1 text-left font-mono text-[11px] leading-none hover:text-signal disabled:opacity-40 ${
        playAllOpen ? "text-signal" : "text-muted-foreground"
      }`}
      disabled={!canPlayAll || bulkBusy}
      aria-expanded={filtering ? playAllOpen : undefined}
      aria-haspopup={filtering ? "menu" : undefined}
      aria-controls={filtering ? "catalogue-play-all-menu" : undefined}
      title={filtering ? "Play filtered tracks…" : `Add all ${scopeLabel} tracks to queue`}
      onclick={onPlayAllClick}
    >
      <PlayIcon class="size-3 shrink-0" aria-hidden="true" />
      <span>Play all</span>
      {#if filtering}
        <ChevronDownIcon class={`size-3 shrink-0 text-muted-foreground transition ${playAllOpen ? "rotate-180" : ""}`} aria-hidden="true" />
      {/if}
    </button>

    {#if filtering && playAllOpen}
      <div
        id="catalogue-play-all-menu"
        bind:this={playAllPanel}
        class="zap-dropdown absolute top-[calc(100%+0.4rem)] left-0 z-[70] w-52 overflow-hidden py-1"
        role="menu"
        aria-label="Play all options"
      >
        {#if queue?.active}
          <button type="button" role="menuitem" class="zap-menu-item" disabled={bulkBusy} onclick={() => void playAll("replace")}>
            <ReplaceIcon class="size-3.5" aria-hidden="true" /> Replace current queue
          </button>
        {/if}
        <button type="button" role="menuitem" class="zap-menu-item" disabled={bulkBusy} onclick={() => void playAll("next")}>
          <ListStartIcon class="size-3.5" aria-hidden="true" /> Play next in queue
        </button>
        <button type="button" role="menuitem" class="zap-menu-item" disabled={bulkBusy} onclick={() => void playAll("last")}>
          <ListEndIcon class="size-3.5" aria-hidden="true" /> Play last in queue
        </button>
        <button type="button" role="menuitem" class="zap-menu-item" disabled={bulkBusy} onclick={() => void playAll("shuffle")}>
          <ShuffleIcon class="size-3.5" aria-hidden="true" /> Shuffle in queue
        </button>
      </div>
    {/if}

    {#if tagFilterValid && !matchingPlaylist}
      <button
        type="button"
        class="inline-flex max-w-full shrink-0 items-center gap-1 text-left font-mono text-[11px] leading-none text-muted-foreground hover:text-signal"
        title="Save current tag filter as a playlist"
        onclick={() => (savePlaylistOpen = true)}
      >
        <ListPlusIcon class="size-3 shrink-0" aria-hidden="true" />
        <span>Save as playlist</span>
      </button>
    {:else if matchingPlaylist}
      <span class="font-mono text-[11px] leading-none text-muted-foreground">
        Matches
        <a href={`/playlists/${matchingPlaylist.id}`} class="text-signal hover:underline">{matchingPlaylist.name}</a>
      </span>
    {/if}
  </div>
{/snippet}

<svelte:document onpointerdown={onPlayAllPointerDown} onkeydown={onPlayAllKeydown} />

<section class="zap-catalogue zap-page">
  <PageHeader title="Catalogue" />

  <CatalogueFilters
    collapsible
    bind:open={filtersOpen}
    bind:libraryScope
    libraryScopeOptions={scopeOptions}
    bind:q
    bind:tagQuery
    bind:selectedTagIds={selected}
    bind:untagged
    {availableTags}
    {topTagIds}
    {tagQueryError}
    busy={loading}
    toolbarExtras={catalogueToolbarExtras}
    actions={addButton}
    onchange={() => {
      // Your library is tagged-only — Untagged needs All (or a playlist).
      if (untagged && libraryScope === "") libraryScope = "all";
      playAllOpen = false;
      void fetchPage({ reset: true });
    }}
  />

  <div class="zap-catalogue-list-col flex min-h-0 min-w-0 flex-1 flex-col gap-3">
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
              <ul class="zap-track-list zap-suggestions">
                {#each suggestions as track (track.id)}
                  <TrackRow {track} {availableTags} {queue} playlists={editablePlaylists} ontags={onTagsSaved} />
                {/each}
              </ul>
              <h2
                class="zap-section-label border-b border-border/50 px-4 pt-3 pb-2 font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase"
              >
                {scopeLabel}
              </h2>
            {/if}
            <ul class="zap-track-list">
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
                  <TrackRow {track} {availableTags} {queue} playlists={editablePlaylists} ontags={onTagsSaved} />
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
