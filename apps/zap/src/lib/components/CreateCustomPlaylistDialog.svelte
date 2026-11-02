<script lang="ts">
  import PlusIcon from "@lucide/svelte/icons/plus";
  import SearchIcon from "@lucide/svelte/icons/search";
  import XIcon from "@lucide/svelte/icons/x";
  import { tagIdsToQuery } from "$lib/tag-filter";
  import type { TagFilterTag } from "$lib/tag-filter";
  import { toast } from "$lib/toast.svelte";

  let {
    open = $bindable(false),
    availableTags = [],
    oncreated,
  }: {
    open?: boolean;
    availableTags?: TagFilterTag[];
    oncreated?: (id: string) => void;
  } = $props();

  let dialog = $state<HTMLDialogElement | null>(null);
  let mode = $state<"tags" | "songs">("tags");
  let name = $state("");
  let selectedTagIds = $state<string[]>([]);
  let songQ = $state("");
  let songBusy = $state(false);
  let saving = $state(false);
  let songs = $state<{ id: string; title: string; artists: string | null }[]>([]);
  let selectedSongIds = $state<string[]>([]);
  let songFetchGen = 0;

  $effect(() => {
    const el = dialog;
    if (!el) return;
    if (open) {
      if (!el.open) el.showModal();
    } else if (el.open) {
      el.close();
    }
  });

  $effect(() => {
    if (!open) return;
    name = "";
    mode = "tags";
    selectedTagIds = [];
    songQ = "";
    selectedSongIds = [];
    songs = [];
  });

  $effect(() => {
    if (!open || mode !== "songs") return;
    const q = songQ;
    const gen = ++songFetchGen;
    const t = setTimeout(() => {
      void loadSongs(q, gen);
    }, 180);
    return () => clearTimeout(t);
  });

  async function loadSongs(q: string, gen: number) {
    songBusy = true;
    try {
      const params = new URLSearchParams({ q, limit: "40", offset: "0", scope: "yours" });
      const res = await fetch(`/api/catalogue?${params}`, { credentials: "same-origin" });
      if (!res.ok || gen !== songFetchGen) return;
      const body = await res.json();
      if (gen !== songFetchGen) return;
      songs = (body.assets ?? []).map((a: { id: string; title: string; artists: string | null }) => ({
        id: a.id,
        title: a.title,
        artists: a.artists,
      }));
    } catch {
      // ignore
    } finally {
      if (gen === songFetchGen) songBusy = false;
    }
  }

  function toggleTag(id: string) {
    selectedTagIds = selectedTagIds.includes(id) ? selectedTagIds.filter((x) => x !== id) : [...selectedTagIds, id];
  }

  function toggleSong(id: string) {
    selectedSongIds = selectedSongIds.includes(id) ? selectedSongIds.filter((x) => x !== id) : [...selectedSongIds, id];
  }

  function close() {
    if (saving) return;
    open = false;
  }

  async function save() {
    if (!name.trim() || saving) return;
    if (mode === "tags" && selectedTagIds.length === 0) {
      toast.error("Select at least one tag");
      return;
    }
    if (mode === "songs" && selectedSongIds.length === 0) {
      toast.error("Select at least one song");
      return;
    }
    saving = true;
    try {
      const body =
        mode === "tags"
          ? { name: name.trim(), tagQuery: tagIdsToQuery(selectedTagIds, availableTags) }
          : { name: name.trim(), mediaAssetIds: selectedSongIds };
      const res = await fetch("/api/playlists", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message ?? "Create failed");
      open = false;
      oncreated?.(json.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed");
    } finally {
      saving = false;
    }
  }

  const canSave = $derived(Boolean(name.trim()) && !saving && (mode === "tags" ? selectedTagIds.length > 0 : selectedSongIds.length > 0));
</script>

<dialog
  bind:this={dialog}
  class="zap-dialog m-auto w-[min(100%,28rem)] max-h-[min(90dvh,36rem)] overflow-hidden rounded-none border border-border bg-card p-0 text-foreground shadow-none backdrop:bg-black/55"
  onclose={() => (open = false)}
  onclick={(e) => {
    if (e.target === dialog) close();
  }}
>
  <div class="flex max-h-[min(90dvh,36rem)] flex-col">
    <header class="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
      <h2 class="font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase">Create custom playlist</h2>
      <button type="button" class="zap-transport-btn size-8" aria-label="Close" disabled={saving} onclick={close}>
        <XIcon class="size-3.5" />
      </button>
    </header>

    <div class="space-y-3 border-b border-border/60 px-4 py-3">
      <label class="block space-y-1">
        <span class="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">Name</span>
        <input class="zap-underline-field" bind:value={name} maxlength="80" placeholder="Playlist name…" disabled={saving} />
      </label>
      <div class="flex gap-1 font-mono text-[11px]" role="tablist" aria-label="Create mode">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "tags"}
          class={`zap-nav-link ${mode === "tags" ? "zap-nav-link-active" : ""}`}
          disabled={saving}
          onclick={() => (mode = "tags")}
        >
          By tags
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "songs"}
          class={`zap-nav-link ${mode === "songs" ? "zap-nav-link-active" : ""}`}
          disabled={saving}
          onclick={() => (mode = "songs")}
        >
          By songs
        </button>
      </div>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto px-4 py-3">
      {#if mode === "tags"}
        <p class="mb-3 font-mono text-[10px] text-muted-foreground">
          Select tags — the playlist always includes songs matching them. Tags can’t be edited later.
        </p>
        {#if availableTags.length === 0}
          <p class="text-sm text-muted-foreground">No tags yet — tag songs in the catalogue first.</p>
        {:else}
          <div class="flex flex-wrap gap-1.5">
            {#each availableTags as tag (tag.id)}
              {@const on = selectedTagIds.includes(tag.id)}
              <button
                type="button"
                class={`zap-tag-chip px-2 py-1 text-[11px] ${on ? "border-signal text-signal bg-signal/15" : ""}`}
                aria-pressed={on}
                disabled={saving}
                onclick={() => toggleTag(tag.id)}
              >
                {#if tag.icon}<span class="mr-0.5" aria-hidden="true">{tag.icon}</span>{/if}
                {tag.name}
              </button>
            {/each}
          </div>
        {/if}
      {:else}
        <div class="relative mb-3">
          <SearchIcon class="pointer-events-none absolute top-1/2 left-0 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input class="zap-underline-field pl-5" bind:value={songQ} placeholder="Search your songs…" disabled={saving} />
        </div>
        {#if songBusy && songs.length === 0}
          <p class="font-mono text-[10px] text-muted-foreground">Loading…</p>
        {:else if songs.length === 0}
          <p class="text-sm text-muted-foreground">No songs match.</p>
        {:else}
          <ul class="zap-track-host space-y-0">
            {#each songs as song (song.id)}
              {@const on = selectedSongIds.includes(song.id)}
              <li>
                <label class="zap-queue-row flex cursor-pointer items-center gap-2 px-1 py-1">
                  <input class="zap-checkbox" type="checkbox" checked={on} disabled={saving} onchange={() => toggleSong(song.id)} />
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-sm">{song.title}</span>
                    <span class="block truncate font-mono text-[10px] text-muted-foreground">{song.artists ?? "—"}</span>
                  </span>
                </label>
              </li>
            {/each}
          </ul>
        {/if}
        {#if selectedSongIds.length}
          <p class="mt-2 font-mono text-[10px] text-signal">{selectedSongIds.length} selected</p>
        {/if}
      {/if}
    </div>

    <footer class="flex items-center justify-end gap-2 border-t border-border/60 px-4 py-3">
      <button
        type="button"
        class="rounded border border-border px-3 py-1.5 font-mono text-[11px] disabled:opacity-40"
        disabled={saving}
        onclick={close}
      >
        Cancel
      </button>
      <button
        type="button"
        class="inline-flex items-center gap-1.5 rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-40"
        disabled={!canSave}
        onclick={() => void save()}
      >
        <PlusIcon class="size-3.5" aria-hidden="true" />
        {saving ? "Saving…" : "Save"}
      </button>
    </footer>
  </div>
</dialog>
