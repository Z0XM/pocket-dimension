<script lang="ts">
  import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";
  import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
  import ListEndIcon from "@lucide/svelte/icons/list-end";
  import ListPlusIcon from "@lucide/svelte/icons/list-plus";
  import ListStartIcon from "@lucide/svelte/icons/list-start";
  import PlayIcon from "@lucide/svelte/icons/play";
  import ReplaceIcon from "@lucide/svelte/icons/replace";
  import ShuffleIcon from "@lucide/svelte/icons/shuffle";
  import CatalogueFilters from "$lib/components/CatalogueFilters.svelte";
  import DiscordSinkPanel from "$lib/components/DiscordSinkPanel.svelte";
  import ListBusyOverlay from "$lib/components/ListBusyOverlay.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import SessionPlayer from "$lib/components/SessionPlayer.svelte";
  import SessionQueueList from "$lib/components/SessionQueueList.svelte";
  import { toast } from "$lib/toast.svelte";
  import SessionSetupPanel from "$lib/components/SessionSetupPanel.svelte";
  import TrackListSkeleton from "$lib/components/TrackListSkeleton.svelte";
  import type { CatalogueFilterInput } from "$lib/catalog-queue-client.svelte";
  import type { BulkEnqueueMode, EnqueueMode } from "$lib/catalog-queue";
  import type { SessionSnapshot } from "$lib/server/sessions/types";
  import type { PageData } from "./$types";
  import { page } from "$app/state";
  import { goto } from "$app/navigation";
  import { untrack } from "svelte";

  let { data }: { data: PageData } = $props();

  const SONG_PAGE = 25;

  let snapshot = $state<SessionSnapshot>(data.snapshot as SessionSnapshot);
  let audioEl = $state<HTMLAudioElement | null>(null);
  let catalogue = $state(data.catalogue);
  let catalogueHasMore = $state(data.catalogueHasMore);
  let catalogueNextOffset = $state(data.catalogueNextOffset);
  let catalogueLoading = $state(false);
  let catalogueLoadingMore = $state(false);
  let catalogueSentinel = $state<HTMLElement | null>(null);
  let catalogueScrollRoot = $state<HTMLElement | null>(null);
  let q = $state(data.catalogueQ);
  let libraryScope = $state(data.catalogueLibraryScope ?? "");
  let selectedTagIds = $state<string[]>([...(data.selectedTagIds ?? [])]);
  let tagQuery = $state(data.catalogueTagQuery ?? "");
  let tagQueryError = $state<string | null>(data.catalogueTagQueryError ?? null);
  let queueBusy = $state(false);
  let bulkBusy = $state(false);
  let playAllOpen = $state(false);
  let playAllTrigger = $state<HTMLButtonElement | null>(null);
  let playAllPanel = $state<HTMLDivElement | null>(null);
  let filtersOpen = $state(false);
  let discordSinkActive = $state(false);
  let catalogueFetchGen = 0;
  let playlists = $state(data.playlists ?? []);
  let tab = $state<"now" | "setup">("now");
  let nowSubTab = $state<"queue" | "library">("queue");

  const sessionRouteId = $derived(page.params.id ?? "");
  const sessionLive = $derived(snapshot.session?.status === "live");
  const canSetup = $derived(Boolean(snapshot.me?.canSetup));
  const canAdd = $derived(Boolean(snapshot.me?.canAdd));

  const libraryScopeOptions = $derived([
    { value: "all", label: "All tracks" },
    ...playlists.map((p) => ({ value: `playlist:${p.id}`, label: `▸ ${p.name}` })),
  ]);
  const filtering = $derived(Boolean(q.trim() || tagQuery.trim() || selectedTagIds.length));
  const scopedPlaylistId = $derived(libraryScope.startsWith("playlist:") ? libraryScope.slice("playlist:".length) : null);
  const scopeLabel = $derived(libraryScopeOptions.find((o) => o.value === libraryScope)?.label.replace(/^▸ /, "") ?? "Your Library");
  const canPlayAll = $derived(canAdd && catalogue.length > 0 && !tagQueryError);
  const queueActive = $derived((snapshot.queue?.length ?? 0) > 0);

  $effect(() => {
    const next = data.snapshot as SessionSnapshot;
    const nextCatalogue = data.catalogue;
    const nextHasMore = data.catalogueHasMore;
    const nextOffset = data.catalogueNextOffset;
    const nextQ = data.catalogueQ;
    const nextScope = data.catalogueLibraryScope ?? "";
    const nextTags = [...(data.selectedTagIds ?? [])];
    const nextTq = data.catalogueTagQuery ?? "";
    const nextTqErr = data.catalogueTagQueryError ?? null;
    const nextPlaylists = data.playlists ?? [];
    untrack(() => {
      snapshot = next;
      catalogue = nextCatalogue;
      catalogueHasMore = nextHasMore;
      catalogueNextOffset = nextOffset;
      q = nextQ;
      libraryScope = nextScope;
      selectedTagIds = nextTags;
      tagQuery = nextTq;
      tagQueryError = nextTqErr;
      playlists = nextPlaylists;
    });
  });

  $effect(() => {
    void sessionRouteId;
    discordSinkActive = false;
    tab = "now";
    nowSubTab = "queue";
  });

  $effect(() => {
    if (!canSetup && tab === "setup") tab = "now";
  });

  $effect(() => {
    if (!canAdd && nowSubTab === "library") nowSubTab = "queue";
  });

  $effect(() => {
    const id = sessionRouteId;
    if (!id) return;

    const live = untrack(() => snapshot.session?.status === "live");
    if (!live) return;

    const es = new EventSource(`/api/sessions/${id}/events`);
    const onSnapshot = (ev: MessageEvent) => {
      try {
        const next = JSON.parse(ev.data) as SessionSnapshot;
        snapshot = next;
        if (next.session?.status !== "live") {
          es.close();
        }
      } catch {
        // ignore malformed
      }
    };
    es.addEventListener("snapshot", onSnapshot);
    es.onerror = () => {
      // Browser auto-reconnects
    };
    return () => {
      es.removeEventListener("snapshot", onSnapshot);
      es.close();
    };
  });

  function catalogueParams(opts: { reset: boolean }) {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (libraryScope === "all") params.set("scope", "all");
    else if (libraryScope.startsWith("playlist:")) params.set("playlist", libraryScope.slice("playlist:".length));
    else params.set("scope", "yours");
    const tq = tagQuery.trim();
    if (tq) params.set("tq", tq);
    else for (const id of selectedTagIds) params.append("tag", id);
    params.set("limit", String(data.cataloguePageSize ?? SONG_PAGE));
    params.set("offset", String(opts.reset ? 0 : catalogueNextOffset));
    return params;
  }

  async function fetchCatalogue(opts: { reset: boolean }) {
    const gen = ++catalogueFetchGen;
    if (opts.reset) {
      catalogueLoading = true;
      tagQueryError = null;
    } else {
      catalogueLoadingMore = true;
    }
    try {
      const res = await fetch(`/api/catalogue?${catalogueParams(opts).toString()}`, {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) return;
      const body = (await res.json()) as {
        assets: typeof catalogue;
        hasMore: boolean;
        nextOffset: number;
        tagQueryError?: string | null;
      };
      if (gen !== catalogueFetchGen) return;
      catalogue = opts.reset ? body.assets : [...catalogue, ...body.assets];
      catalogueHasMore = body.hasMore;
      catalogueNextOffset = body.nextOffset;
      tagQueryError = body.tagQueryError ?? null;
    } finally {
      if (gen === catalogueFetchGen) {
        catalogueLoading = false;
        catalogueLoadingMore = false;
      }
    }
  }

  $effect(() => {
    if (!sessionLive || !catalogueSentinel) return;
    const el = catalogueSentinel;
    const root = catalogueScrollRoot;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && catalogueHasMore && !catalogueLoading && !catalogueLoadingMore) {
          void fetchCatalogue({ reset: false });
        }
      },
      { root, rootMargin: "120px" }
    );
    io.observe(el);
    return () => io.disconnect();
  });

  function enqueueToast(mode: EnqueueMode, count = 1) {
    const label = mode === "next" ? "Playing next" : mode === "queue" ? "Added to queue" : mode === "play" ? "Playing" : "Added to the end";
    toast.success(count === 1 ? `${label}.` : `${label}: ${count} tracks.`);
  }

  async function enqueue(mediaAssetId: string, mode: EnqueueMode) {
    if (!snapshot.session) return;
    queueBusy = true;
    try {
      const res = await fetch(`/api/sessions/${snapshot.session.id}/queue`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ mediaAssetId, mode }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message ?? `Enqueue failed (${res.status})`);
      snapshot = body as SessionSnapshot;
      enqueueToast(mode);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Enqueue failed");
    } finally {
      queueBusy = false;
    }
  }

  function filterInput(): CatalogueFilterInput {
    const tq = tagQuery.trim();
    return {
      scope: scopedPlaylistId ? "playlist" : libraryScope === "all" ? "all" : "yours",
      playlistId: scopedPlaylistId,
      q: q.trim(),
      tagQuery: tq,
      tagIds: tq ? [] : selectedTagIds,
    };
  }

  async function playAll(mode: BulkEnqueueMode) {
    if (!snapshot.session || bulkBusy || !canPlayAll) return;
    playAllOpen = false;
    bulkBusy = true;
    try {
      const res = await fetch(`/api/sessions/${snapshot.session.id}/queue`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ action: "enqueueFiltered", filter: filterInput(), mode }),
      });
      const body = (await res.json().catch(() => ({}))) as SessionSnapshot & { message?: string; notice?: string };
      if (!res.ok) throw new Error(body?.message ?? `Enqueue failed (${res.status})`);
      snapshot = body;
      nowSubTab = "queue";
      toast.success(body.notice ?? "Queued tracks.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Enqueue failed");
    } finally {
      bulkBusy = false;
    }
  }

  function onPlayAllClick() {
    if (!canPlayAll || bulkBusy || queueBusy) return;
    if (!filtering) {
      void playAll("last");
      return;
    }
    filtersOpen = false;
    playAllOpen = !playAllOpen;
  }

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

  $effect(() => {
    if (filtersOpen) playAllOpen = false;
  });
</script>

{#snippet sessionPlayAllExtras()}
  <div class="relative inline-flex shrink-0 items-center gap-3">
    <button
      type="button"
      bind:this={playAllTrigger}
      class={`zap-meta-disclosure disabled:opacity-40 ${playAllOpen ? "is-open" : ""}`}
      disabled={!canPlayAll || bulkBusy || queueBusy}
      aria-expanded={filtering ? playAllOpen : undefined}
      aria-haspopup={filtering ? "menu" : undefined}
      aria-controls={filtering ? "session-play-all-menu" : undefined}
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
        id="session-play-all-menu"
        bind:this={playAllPanel}
        class="zap-dropdown absolute top-[calc(100%+0.4rem)] left-0 z-[70] w-52 overflow-hidden py-1"
        role="menu"
        aria-label="Play all options"
      >
        {#if queueActive}
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
  </div>
{/snippet}

<svelte:document onpointerdown={onPlayAllPointerDown} onkeydown={onPlayAllKeydown} />

<audio bind:this={audioEl} preload="auto" class="hidden"></audio>

<section class="zap-page">
  <PageHeader title="Session">
    {#snippet actions()}
      {#if !sessionLive}
        <a href="/session?stay=1" class="auth-btn inline-flex items-center gap-1.5">
          <ArrowLeftIcon class="size-3.5" aria-hidden="true" />
          Sessions
        </a>
      {/if}
    {/snippet}
    {#if sessionLive}
      <div class="flex flex-wrap gap-1 font-mono text-[11px]" role="tablist" aria-label="Session views">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "now"}
          class={`zap-nav-link ${tab === "now" ? "zap-nav-link-active" : ""}`}
          onclick={() => (tab = "now")}
        >
          Now playing
        </button>
        {#if canSetup}
          <button
            type="button"
            role="tab"
            aria-selected={tab === "setup"}
            class={`zap-nav-link ${tab === "setup" ? "zap-nav-link-active" : ""}`}
            onclick={() => (tab = "setup")}
          >
            Setup
          </button>
        {/if}
      </div>
    {/if}
  </PageHeader>

  <div class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain">
    {#if tab === "setup" && sessionLive && canSetup}
      <SessionSetupPanel bind:snapshot bind:discordSinkActive />
    {:else}
      {#if sessionLive}
        {#key sessionRouteId}
          <DiscordSinkPanel sessionId={sessionRouteId} canManage={canSetup} variant="banner" bind:active={discordSinkActive} />
        {/key}
      {/if}

      <SessionPlayer bind:snapshot bind:audioEl />

      {#if sessionLive}
        <div class="space-y-4">
          <div class="flex gap-1 border-b border-border/60" role="tablist" aria-label="Now playing panels">
            <button
              type="button"
              role="tab"
              aria-selected={nowSubTab === "queue"}
              class={`border-b-2 px-3 py-2 font-mono text-[11px] tracking-[0.12em] uppercase ${
                nowSubTab === "queue" ? "border-signal text-signal" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
              onclick={() => (nowSubTab = "queue")}
            >
              Queue
            </button>
            {#if canAdd}
              <button
                type="button"
                role="tab"
                aria-selected={nowSubTab === "library"}
                class={`border-b-2 px-3 py-2 font-mono text-[11px] tracking-[0.12em] uppercase ${
                  nowSubTab === "library" ? "border-signal text-signal" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
                onclick={() => (nowSubTab = "library")}
              >
                Add from library
              </button>
            {/if}
          </div>

          {#if nowSubTab === "library" && canAdd}
            <div class="zap-catalogue space-y-3" role="tabpanel" aria-label="Add from library">
              <CatalogueFilters
                compact
                collapsible
                bind:open={filtersOpen}
                bind:libraryScope
                {libraryScopeOptions}
                bind:q
                bind:tagQuery
                bind:selectedTagIds
                availableTags={data.availableTags}
                topTagIds={data.topTagIds}
                {tagQueryError}
                busy={catalogueLoading}
                toolbarExtras={sessionPlayAllExtras}
                onchange={() => {
                  playAllOpen = false;
                  void fetchCatalogue({ reset: true });
                }}
              />
              {#if catalogueLoading && catalogue.length === 0}
                <TrackListSkeleton rows={5} compact />
              {:else}
                <ListBusyOverlay busy={catalogueLoading && catalogue.length > 0} label="Updating…">
                  <ul
                    bind:this={catalogueScrollRoot}
                    class="zap-track-host max-h-[min(32rem,70vh)] min-h-[8rem] overflow-y-auto"
                  >
                    {#if catalogue.length === 0}
                      <li class="py-8 text-center text-sm text-muted-foreground">No tracks.</li>
                    {:else}
                      {#each catalogue as track (track.id)}
                        <li class="zap-track group flex items-center justify-between gap-2 py-1.5">
                          <div class="min-w-0">
                            <p class="zap-track-title truncate text-sm font-medium {track.available === false ? 'text-muted-foreground' : ''}">{track.title}</p>
                            <p class="truncate font-mono text-[10px] text-muted-foreground">
                              {track.artists ?? "Unknown"}{#if track.available === false}
                                · <span class="text-destructive">Song not available</span>{/if}
                            </p>
                          </div>
                          <div class="flex shrink-0 items-center gap-0.5">
                            <button
                              type="button"
                              class="zap-transport-btn size-7 disabled:opacity-40"
                              disabled={!track.playable || queueBusy}
                              title="Play next"
                              aria-label={`Play next: ${track.title}`}
                              onclick={() => void enqueue(track.id, "next")}
                            >
                              <ListStartIcon class="size-3.5" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              class="zap-transport-btn size-7 disabled:opacity-40"
                              disabled={!track.playable || queueBusy}
                              title="Play last"
                              aria-label={`Play last: ${track.title}`}
                              onclick={() => void enqueue(track.id, "last")}
                            >
                              <ListEndIcon class="size-3.5" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              class="zap-transport-btn size-7 disabled:opacity-40"
                              disabled={!track.playable || queueBusy}
                              title="Add to queue"
                              aria-label={`Add to queue: ${track.title}`}
                              onclick={() => void enqueue(track.id, "queue")}
                            >
                              <ListPlusIcon class="size-3.5" aria-hidden="true" />
                            </button>
                          </div>
                        </li>
                      {/each}
                      <li bind:this={catalogueSentinel} class="h-4 list-none" aria-hidden="true"></li>
                      {#if catalogueLoadingMore}
                        <li class="py-2 text-center font-mono text-[10px] text-muted-foreground">Loading more…</li>
                      {:else if !catalogueHasMore}
                        <li class="py-2 text-center font-mono text-[10px] text-muted-foreground">End of list</li>
                      {/if}
                    {/if}
                  </ul>
                </ListBusyOverlay>
              {/if}
            </div>
          {:else}
            <div role="tabpanel" aria-label="Queue">
              <SessionQueueList
                bind:snapshot
                busy={queueBusy}
                showHeading={false}
                onerror={(m) => {
                  if (m) toast.error(m);
                }}
              />
            </div>
          {/if}
        </div>
      {:else}
        <p class="font-mono text-[11px] text-muted-foreground">
          This session is over.
          <button type="button" class="text-signal hover:underline" onclick={() => goto("/session?stay=1")}>Back to sessions</button>
        </p>
      {/if}
    {/if}
  </div>
</section>
