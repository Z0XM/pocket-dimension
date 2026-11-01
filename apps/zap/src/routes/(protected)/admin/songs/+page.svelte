<script lang="ts">
  import { goto, invalidateAll } from "$app/navigation";
  import { page } from "$app/state";
  import ArchiveRestoreIcon from "@lucide/svelte/icons/archive-restore";
  import SearchIcon from "@lucide/svelte/icons/search";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";
  import SongDispositionDialog from "$lib/components/SongDispositionDialog.svelte";
  import ZapSelect from "$lib/components/ZapSelect.svelte";
  import { archiveSongAsAdmin, deleteSongAsAdmin, unarchiveSongAsAdmin } from "$lib/admin-song-delete";
  import type { AdminSongRow } from "$lib/server/admin/media";
  import { toast } from "$lib/toast.svelte";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  const statusOptions = [
    { value: "ready", label: "Ready" },
    { value: "unavailable", label: "Unavailable" },
    { value: "failed", label: "Failed" },
    { value: "pending", label: "Pending" },
    { value: "archived", label: "Archived" },
  ];
  const statusClasses: Record<string, string> = {
    ready: "border-border text-muted-foreground",
    unavailable: "border-destructive/40 bg-destructive/10 text-destructive",
    failed: "border-destructive/40 bg-destructive/10 text-destructive",
    pending: "border-amber-500/40 bg-amber-500/10 text-amber-400",
    archived: "border-border/80 bg-secondary/60 text-muted-foreground",
  };

  let q = $state("");
  let status = $state("");
  let songs = $state<AdminSongRow[]>([]);
  let nextOffset = $state(0);
  let hasMore = $state(false);
  let total = $state(0);
  let loadingMore = $state(false);
  let scrollRoot = $state<HTMLDivElement | null>(null);
  let sentinel = $state<HTMLDivElement | null>(null);
  let fetchGen = 0;

  $effect(() => {
    q = data.filters.q;
    status = data.filters.status;
    songs = [...data.songs];
    nextOffset = data.nextOffset;
    hasMore = data.hasMore;
    total = data.total;
    scrollRoot?.scrollTo({ top: 0 });
  });

  let target = $state<AdminSongRow | null>(null);
  let confirmOpen = $state(false);
  let busy = $state(false);

  function navigate(next: { q?: string; status?: string }) {
    const params = new URLSearchParams();
    const nq = (next.q ?? q).trim();
    const ns = next.status ?? status;
    if (nq) params.set("q", nq);
    if (ns) params.set("status", ns);
    const qs = params.toString();
    void goto(qs ? `${page.url.pathname}?${qs}` : page.url.pathname, { keepFocus: true, noScroll: true });
  }

  async function loadMore() {
    if (!hasMore || loadingMore) return;
    const gen = ++fetchGen;
    const offset = nextOffset;
    loadingMore = true;
    try {
      const params = new URLSearchParams();
      params.set("offset", String(offset));
      if (q.trim()) params.set("q", q.trim());
      if (status) params.set("status", status);
      const res = await fetch(`/api/admin/songs?${params}`, {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error(`Failed to load songs (${res.status})`);
      const body = (await res.json()) as { songs: AdminSongRow[]; hasMore: boolean; nextOffset: number; total: number };
      if (gen !== fetchGen) return;
      const seen = new Set(songs.map((s) => s.id));
      songs = [...songs, ...body.songs.filter((s) => !seen.has(s.id))];
      hasMore = body.hasMore;
      nextOffset = body.nextOffset;
      total = body.total;
    } catch (err) {
      if (gen !== fetchGen) return;
      toast.error(err instanceof Error ? err.message : "Failed to load songs");
    } finally {
      if (gen === fetchGen) loadingMore = false;
    }
  }

  $effect(() => {
    if (!sentinel || !scrollRoot) return;
    const el = sentinel;
    void songs.length;
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

  async function confirmArchive() {
    if (!target) return;
    busy = true;
    const outcome = await archiveSongAsAdmin(target.id);
    busy = false;
    confirmOpen = false;
    if (outcome.ok) {
      toast.success(outcome.message);
      await invalidateAll();
    } else {
      toast.error(outcome.message);
    }
  }

  async function confirmDelete() {
    if (!target) return;
    busy = true;
    const outcome = await deleteSongAsAdmin(target.id);
    busy = false;
    confirmOpen = false;
    if (outcome.ok) {
      toast.success(outcome.message);
      await invalidateAll();
    } else {
      toast.error(outcome.message);
    }
  }

  async function unarchive(song: AdminSongRow) {
    busy = true;
    const outcome = await unarchiveSongAsAdmin(song.id);
    busy = false;
    if (outcome.ok) {
      toast.success(outcome.message);
      await invalidateAll();
    } else {
      toast.error(outcome.message);
    }
  }

  function formatWhen(iso: string) {
    try {
      return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(iso));
    } catch {
      return iso;
    }
  }

  function openSource(song: AdminSongRow) {
    if (!song.externalUrl) return;
    window.open(song.externalUrl, "_blank", "noopener,noreferrer");
  }
</script>

<div class="flex min-h-0 flex-1 flex-col gap-4">
  <form
    class="grid shrink-0 items-center gap-2 rounded-lg border border-border/70 bg-card p-4 sm:grid-cols-[minmax(0,1fr)_12rem_auto]"
    onsubmit={(e) => {
      e.preventDefault();
      navigate({});
    }}
  >
    <div class="relative min-w-0">
      <SearchIcon class="pointer-events-none absolute top-1/2 left-2.5 size-4 shrink-0 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <input
        class="auth-field w-full pl-9"
        type="search"
        placeholder="Title, artist or source id"
        aria-label="Search songs"
        bind:value={q}
        autocomplete="off"
      />
    </div>
    <div class="min-w-0 sm:w-48">
      <ZapSelect options={statusOptions} bind:value={status} placeholder="Any status" onChange={(v) => navigate({ status: v })} />
    </div>
    <button type="submit" class="auth-btn inline-flex h-auto min-h-10 w-fit shrink-0 items-center justify-center gap-1.5 whitespace-nowrap px-4 py-2">
      <SearchIcon class="size-3.5 shrink-0" aria-hidden="true" />
      Search
    </button>
  </form>

  {#if !data.storageConfigured}
    <p class="shrink-0 rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-400">
      Object storage isn’t configured here — deletes remove DB rows but can’t delete R2 objects.
    </p>
  {/if}
  <p class="shrink-0 font-mono text-[11px] text-muted-foreground">{total} song(s){data.filters.q || data.filters.status ? " match" : ""}</p>

  {#if songs.length === 0}
    <p class="rounded border border-dashed border-border/70 px-4 py-6 text-center text-sm text-muted-foreground">No songs.</p>
  {:else}
    <div bind:this={scrollRoot} class="zap-track-host min-h-0 flex-1 overflow-y-auto overscroll-contain" role="region" aria-label="Songs">
      <ul class="divide-y divide-border/60">
        {#each songs as song (song.id)}
          <li class="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              class="min-w-0 flex-1 text-left disabled:cursor-default"
              disabled={!song.externalUrl}
              title={song.externalUrl ? "Open source URL" : "No source URL"}
              onclick={() => openSource(song)}
            >
              <p class="flex flex-wrap items-center gap-2">
                <span class={`truncate font-medium ${song.externalUrl ? "hover:text-signal hover:underline" : ""}`}>{song.title}</span>
                <span class={`rounded-full border px-2 py-0.5 font-mono text-[10px] ${statusClasses[song.status] ?? ""}`}>{song.status}</span>
              </p>
              <p class="font-mono text-[11px] text-muted-foreground">
                {song.artists ?? "Unknown"} · {song.sourceType} · {song.hasStorageObject ? "in storage" : "no storage object"} · added {formatWhen(
                  song.createdAt
                )}{#if song.addedBy}
                  by {song.addedBy}{/if}
              </p>
            </button>
            <div class="flex shrink-0 items-center gap-1.5">
              {#if song.status === "archived"}
                <button
                  type="button"
                  class="inline-flex size-8 items-center justify-center border border-border text-muted-foreground hover:bg-secondary disabled:opacity-40"
                  aria-label={`Unarchive ${song.title}`}
                  title="Unarchive song"
                  disabled={busy}
                  onclick={() => void unarchive(song)}
                >
                  <ArchiveRestoreIcon class="size-3.5 shrink-0" aria-hidden="true" />
                </button>
              {/if}
              <button
                type="button"
                class="inline-flex size-8 items-center justify-center border border-destructive/40 text-destructive hover:bg-destructive/10 disabled:opacity-40"
                aria-label={`Remove ${song.title}`}
                title="Archive or delete song"
                disabled={busy}
                onclick={() => {
                  target = song;
                  confirmOpen = true;
                }}
              >
                <Trash2Icon class="size-3.5 shrink-0" aria-hidden="true" />
              </button>
            </div>
          </li>
        {/each}
      </ul>
      <div bind:this={sentinel} class="h-8" aria-hidden="true"></div>
      {#if loadingMore}
        <p class="px-4 pb-3 font-mono text-[10px] text-muted-foreground">Loading more…</p>
      {:else if !hasMore}
        <p class="px-4 pb-3 font-mono text-[10px] text-muted-foreground">End of songs</p>
      {/if}
    </div>
  {/if}
</div>

<SongDispositionDialog
  bind:open={confirmOpen}
  title={target ? `Remove "${target.title}"?` : "Remove song?"}
  body={target?.status === "archived"
    ? "Delete permanently removes the catalogue row and storage object. This can't be undone."
    : "Archive hides it from everyone except Admin → Songs (reversible). Delete permanently removes the catalogue row and storage object."}
  busy={busy}
  showArchive={target?.status !== "archived"}
  onarchive={confirmArchive}
  ondelete={confirmDelete}
/>
