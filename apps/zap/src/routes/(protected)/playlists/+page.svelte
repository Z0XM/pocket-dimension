<script lang="ts">
  import PlusIcon from "@lucide/svelte/icons/plus";
  import SearchIcon from "@lucide/svelte/icons/search";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";
  import ConfirmDialog from "$lib/components/ConfirmDialog.svelte";
  import CreateCustomPlaylistDialog from "$lib/components/CreateCustomPlaylistDialog.svelte";
  import CreateLinkedPlaylistDialog from "$lib/components/CreateLinkedPlaylistDialog.svelte";
  import FollowPlaylistDialog from "$lib/components/FollowPlaylistDialog.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import QueueTagMarks from "$lib/components/QueueTagMarks.svelte";
  import { youtubePlaylistHref } from "$lib/history-time";
  import { playlistRelationBadge } from "$lib/playlist-relation-label";
  import {
    PLAYLIST_SECTIONS,
    filterByNameSearch,
    filterPlaylistsBySection,
    tagsFromPlaylistQuery,
    type PlaylistSectionId,
  } from "$lib/playlist-sections";
  import { toast } from "$lib/toast.svelte";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  let playlists = $state(data.playlists ?? []);
  let section = $state<PlaylistSectionId>("all");
  let searchBySection = $state<Record<PlaylistSectionId, string>>({
    all: "",
    custom: "",
    following: "",
    linked: "",
    saved: "",
    connected: "",
  });
  let createCustomOpen = $state(false);
  let followOpen = $state(false);
  let linkedOpen = $state(false);
  let deleteTarget = $state<{ id: string; name: string; trackCount: number } | null>(null);
  let deleteOpen = $state(false);
  let deleting = $state(false);

  const searchQ = $derived(searchBySection[section] ?? "");
  const sectionPlaylists = $derived(filterByNameSearch(filterPlaylistsBySection(playlists, section), searchQ));
  const sectionSaved = $derived(filterByNameSearch(data.savedQueues ?? [], searchQ));
  const sectionConnected = $derived(filterByNameSearch(data.connectedPlaylists ?? [], searchQ));

  const createLabel = $derived(
    section === "following" ? "Follow" : section === "linked" ? "Link" : section === "saved" ? "Save" : section === "connected" ? "Connect" : "Create"
  );

  $effect(() => {
    playlists = data.playlists ?? [];
  });

  function setSearch(value: string) {
    searchBySection = { ...searchBySection, [section]: value };
  }

  function onCreate() {
    if (section === "following") {
      followOpen = true;
      return;
    }
    if (section === "linked") {
      linkedOpen = true;
      return;
    }
    if (section === "saved") {
      toast.info("Save a queue from a live session — use Save for later there.");
      return;
    }
    if (section === "connected") {
      window.location.href = "/connections";
      return;
    }
    createCustomOpen = true;
  }

  function askDelete(pl: { id: string; name: string; trackCount: number }) {
    deleteTarget = pl;
    deleteOpen = true;
  }

  async function confirmDelete() {
    const target = deleteTarget;
    if (!target) return;
    deleting = true;
    try {
      const res = await fetch(`/api/playlists/${target.id}`, { method: "DELETE", credentials: "same-origin" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok && res.status !== 404) throw new Error(body?.message ?? "Delete failed");
      playlists = playlists.filter((p) => p.id !== target.id);
      toast.success(`Deleted “${target.name}”.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      deleting = false;
      deleteOpen = false;
      deleteTarget = null;
    }
  }

  function goPlaylist(id: string) {
    window.location.href = `/playlists/${id}`;
  }
</script>

<section class="zap-page">
  <PageHeader title="Playlists" />

  <div class="flex flex-wrap gap-1 border-b border-border/60 font-mono text-[11px]" role="tablist" aria-label="Playlist sections">
    {#each PLAYLIST_SECTIONS as tab}
      <button
        type="button"
        role="tab"
        aria-selected={section === tab.id}
        class={`zap-nav-link ${section === tab.id ? "zap-nav-link-active" : ""}`}
        onclick={() => (section = tab.id)}
      >
        {tab.label}
      </button>
    {/each}
  </div>

  <div class="flex shrink-0 items-end gap-2 pt-3">
    <label class="relative min-w-0 flex-1">
      <span class="sr-only">Search {section} playlists</span>
      <SearchIcon class="pointer-events-none absolute top-1/2 left-0 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <input
        class="zap-underline-field w-full pl-5"
        value={searchQ}
        oninput={(e) => setSearch((e.currentTarget as HTMLInputElement).value)}
        placeholder="Search playlists…"
      />
    </label>
    <button
      type="button"
      class="inline-flex shrink-0 items-center gap-1.5 rounded bg-primary px-3 py-2 text-xs font-medium text-primary-foreground"
      onclick={onCreate}
    >
      <PlusIcon class="size-3.5" aria-hidden="true" />
      {createLabel}
    </button>
  </div>

  <div class="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain pt-3">
    {#if section === "saved"}
      {#if sectionSaved.length === 0}
        <p class="rounded border border-dashed border-border/70 px-4 py-6 text-center text-sm text-muted-foreground">
          {searchQ.trim() ? "No saved queues match." : "None yet — use “Save for later” in a session."}
        </p>
      {:else}
        <ul class="zap-track-host">
          {#each sectionSaved as sq (sq.id)}
            <li class="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
              <div class="min-w-0">
                <p class="font-medium">{sq.name}</p>
                <p class="font-mono text-[11px] text-muted-foreground">{sq.trackCount} tracks · {sq.titles.slice(0, 3).join(", ")}</p>
              </div>
              {#if data.primaryLive}
                <a
                  href={`/session/${data.primaryLive.id}`}
                  class="rounded border border-signal/40 px-2 py-1 font-mono text-[10px] text-signal hover:bg-signal/10"
                >
                  Open session to load
                </a>
              {:else if data.canStart}
                <span class="font-mono text-[10px] text-muted-foreground">Start a session to load</span>
              {:else}
                <span class="font-mono text-[10px] text-muted-foreground">Join/resume a session to load</span>
              {/if}
            </li>
          {/each}
        </ul>
      {/if}
    {:else if section === "connected"}
      {#if !data.youtubeLinked}
        <p class="rounded border border-dashed border-border/70 px-4 py-6 text-center text-sm text-muted-foreground">
          Connect YouTube in <a class="text-signal underline" href="/connections">Connections</a> to see playlists here.
        </p>
      {:else if sectionConnected.length === 0}
        <p class="rounded border border-dashed border-border/70 px-4 py-6 text-center text-sm text-muted-foreground">
          {searchQ.trim() ? "No connected playlists match." : "No connected playlists found."}
        </p>
      {:else}
        <ul class="zap-track-host">
          {#each sectionConnected as pl (pl.id)}
            <li class="flex items-center gap-2 px-3 py-2">
              <a href={youtubePlaylistHref(pl.id)} class="min-w-0 flex-1 text-sm hover:text-signal" target="_blank" rel="noreferrer">
                <span class="font-medium">{pl.title}</span>
                <span class="ml-2 font-mono text-[10px] text-muted-foreground">
                  {pl.itemCount != null ? `${pl.itemCount} · ` : ""}{pl.importStatus?.replaceAll("_", " ") ?? "youtube"}
                </span>
              </a>
            </li>
          {/each}
        </ul>
      {/if}
    {:else if sectionPlaylists.length === 0}
      <p class="rounded border border-dashed border-border/70 px-4 py-6 text-center text-sm text-muted-foreground">
        {searchQ.trim()
          ? "No playlists match."
          : section === "following"
            ? "You’re not following any playlists yet."
            : section === "linked"
              ? "No linked playlists yet."
              : section === "custom"
                ? "No custom playlists yet — create one from tags or songs."
                : "No playlists yet."}
      </p>
    {:else}
      <ul class="zap-track-host">
        {#each sectionPlaylists as pl (pl.id)}
          {@const badge = playlistRelationBadge(pl.relation, pl.kind)}
          {@const tags = tagsFromPlaylistQuery(pl.tagQuery, data.availableTags)}
          <li class="zap-queue-row group flex items-start gap-2 px-2 py-1 sm:py-1.5">
            <a href={`/playlists/${pl.id}`} class="min-w-0 flex-1 px-1 text-left hover:text-signal">
              <span class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span class="text-sm font-medium">{pl.name}</span>
                <span class="font-mono text-[10px] text-muted-foreground">
                  {pl.trackCount}
                  {#if pl.kind === "standard" && !pl.tagQuery}
                    · freehand{/if}
                  {#if badge}
                    · {badge}{/if}
                </span>
              </span>
              {#if tags.length}
                <span class="mt-1 block">
                  <QueueTagMarks {tags} />
                </span>
              {/if}
            </a>
            {#if pl.canDelete}
              <button
                type="button"
                class="inline-flex size-7 shrink-0 items-center justify-center rounded text-muted-foreground opacity-70 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 disabled:opacity-40"
                aria-label={`Delete ${pl.name}`}
                title="Delete playlist"
                disabled={deleting}
                onclick={() => askDelete(pl)}
              >
                <Trash2Icon class="size-3.5" aria-hidden="true" />
              </button>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}

    {#if section === "all" && (sectionSaved.length > 0 || (data.youtubeLinked && sectionConnected.length > 0))}
      {#if sectionSaved.length > 0}
        <div class="space-y-2 border-t border-border/50 pt-4">
          <h2 class="zap-section-label font-mono text-[10px] tracking-[0.18em] uppercase">Saved queues</h2>
          <ul class="zap-track-host">
            {#each sectionSaved as sq (sq.id)}
              <li class="px-3 py-2 text-sm">
                <p class="font-medium">{sq.name}</p>
                <p class="font-mono text-[11px] text-muted-foreground">{sq.trackCount} tracks</p>
              </li>
            {/each}
          </ul>
        </div>
      {/if}
      {#if data.youtubeLinked && sectionConnected.length > 0}
        <div class="space-y-2 border-t border-border/50 pt-4">
          <h2 class="zap-section-label font-mono text-[10px] tracking-[0.18em] uppercase">Connected</h2>
          <ul class="zap-track-host">
            {#each sectionConnected as pl (pl.id)}
              <li class="px-3 py-2 text-sm">
                <a href={youtubePlaylistHref(pl.id)} class="hover:text-signal" target="_blank" rel="noreferrer">{pl.title}</a>
              </li>
            {/each}
          </ul>
        </div>
      {/if}
    {/if}
  </div>
</section>

<CreateCustomPlaylistDialog bind:open={createCustomOpen} availableTags={data.availableTags} oncreated={goPlaylist} />
<FollowPlaylistDialog bind:open={followOpen} onfollowed={goPlaylist} />
<CreateLinkedPlaylistDialog bind:open={linkedOpen} oncreated={goPlaylist} />

<ConfirmDialog
  bind:open={deleteOpen}
  title="Delete playlist?"
  body={deleteTarget
    ? `“${deleteTarget.name}” (${deleteTarget.trackCount} track${deleteTarget.trackCount === 1 ? "" : "s"}) will be deleted for you and any collaborators. The tracks stay in the catalogue and in your queue.`
    : ""}
  confirmLabel="Delete playlist"
  danger
  busy={deleting}
  onconfirm={confirmDelete}
/>
