<script lang="ts">
  import { goto, invalidateAll } from "$app/navigation";
  import { page } from "$app/state";
  import ConfirmDialog from "$lib/components/ConfirmDialog.svelte";
  import ZapSelect from "$lib/components/ZapSelect.svelte";
  import { deleteSongAsAdmin, SONG_DELETE_CONFIRM_BODY } from "$lib/admin-song-delete";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  const statusOptions = [
    { value: "ready", label: "Ready" },
    { value: "unavailable", label: "Unavailable" },
    { value: "failed", label: "Failed" },
    { value: "pending", label: "Pending" },
  ];
  const statusClasses: Record<string, string> = {
    ready: "border-border text-muted-foreground",
    unavailable: "border-destructive/40 bg-destructive/10 text-destructive",
    failed: "border-destructive/40 bg-destructive/10 text-destructive",
    pending: "border-amber-500/40 bg-amber-500/10 text-amber-400",
  };

  let q = $state("");
  let status = $state("");
  $effect(() => {
    q = data.filters.q;
    status = data.filters.status;
  });

  let target = $state<PageData["songs"][number] | null>(null);
  let confirmOpen = $state(false);
  let busy = $state(false);
  let message = $state<string | null>(null);
  let errorMessage = $state<string | null>(null);

  function navigate(next: { q?: string; status?: string; offset?: number }) {
    const params = new URLSearchParams();
    const nq = (next.q ?? q).trim();
    const ns = next.status ?? status;
    if (nq) params.set("q", nq);
    if (ns) params.set("status", ns);
    if (next.offset) params.set("offset", String(next.offset));
    const qs = params.toString();
    void goto(qs ? `${page.url.pathname}?${qs}` : page.url.pathname, { keepFocus: true, noScroll: true });
  }

  async function confirmDelete() {
    if (!target) return;
    busy = true;
    errorMessage = null;
    message = null;
    const outcome = await deleteSongAsAdmin(target.id);
    busy = false;
    confirmOpen = false;
    if (outcome.ok) {
      message = outcome.message;
      await invalidateAll();
    } else {
      errorMessage = outcome.message;
    }
  }

  function formatWhen(iso: string) {
    try {
      return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(iso));
    } catch {
      return iso;
    }
  }
</script>

<div class="space-y-4">
  <form
    class="grid gap-2 rounded-lg border border-border/70 bg-card/50 p-4 sm:grid-cols-[1fr_12rem_auto]"
    onsubmit={(e) => {
      e.preventDefault();
      navigate({});
    }}
  >
    <input class="auth-field" placeholder="Title, artist or source id" bind:value={q} />
    <ZapSelect options={statusOptions} bind:value={status} placeholder="Any status" onChange={(v) => navigate({ status: v })} />
    <button type="submit" class="auth-btn w-fit">Search</button>
  </form>

  {#if !data.storageConfigured}
    <p class="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-400">
      Object storage isn’t configured here — deletes remove DB rows but can’t delete R2 objects.
    </p>
  {/if}
  {#if message}<p class="text-sm text-signal">{message}</p>{/if}
  {#if errorMessage}<p class="auth-error">{errorMessage}</p>{/if}

  <p class="font-mono text-[11px] text-muted-foreground">{data.total} song(s){data.filters.q || data.filters.status ? " match" : ""}</p>

  {#if data.songs.length === 0}
    <p class="rounded border border-dashed border-border/70 px-4 py-6 text-center text-sm text-muted-foreground">No songs.</p>
  {:else}
    <ul class="divide-y divide-border/60 rounded-lg border border-border/70 bg-card/30">
      {#each data.songs as song (song.id)}
        <li class="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div class="min-w-0">
            <p class="flex flex-wrap items-center gap-2">
              <span class="truncate font-medium">{song.title}</span>
              <span class={`rounded-full border px-2 py-0.5 font-mono text-[10px] ${statusClasses[song.status] ?? ""}`}>{song.status}</span>
            </p>
            <p class="font-mono text-[11px] text-muted-foreground">
              {song.artists ?? "Unknown"} · {song.sourceType} · {song.hasStorageObject ? "in storage" : "no storage object"} · added {formatWhen(
                song.createdAt
              )}{#if song.addedBy}
                by {song.addedBy}{/if}
              {#if song.externalUrl}
                · <a class="underline-offset-2 hover:text-signal hover:underline" href={song.externalUrl} target="_blank" rel="noreferrer">source</a>
              {/if}
            </p>
          </div>
          <button
            type="button"
            class="w-fit rounded border border-destructive/40 px-2 py-1 font-mono text-[11px] text-destructive hover:bg-destructive/10"
            disabled={busy}
            onclick={() => {
              target = song;
              confirmOpen = true;
            }}>Delete</button
          >
        </li>
      {/each}
    </ul>
    <div class="flex justify-between font-mono text-[11px]">
      {#if data.offset > 0}
        <button type="button" class="text-signal hover:underline" onclick={() => navigate({ offset: Math.max(data.offset - data.pageSize, 0) })}
          >← Newer</button
        >
      {:else}
        <span></span>
      {/if}
      {#if data.hasMore}
        <button type="button" class="text-signal hover:underline" onclick={() => navigate({ offset: data.nextOffset })}>Older →</button>
      {/if}
    </div>
  {/if}
</div>

<ConfirmDialog
  bind:open={confirmOpen}
  title={target ? `Delete "${target.title}"?` : "Delete song?"}
  body={SONG_DELETE_CONFIRM_BODY}
  confirmLabel="Delete song"
  danger
  {busy}
  onconfirm={confirmDelete}
/>
