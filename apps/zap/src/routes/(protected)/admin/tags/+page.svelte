<script lang="ts">
  import { enhance } from "$app/forms";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import XIcon from "@lucide/svelte/icons/x";
  import ConfirmDialog from "$lib/components/ConfirmDialog.svelte";
  import type { SystemTagRow } from "$lib/server/admin/tags";
  import type { ActionData, PageData } from "./$types";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let name = $state("");
  let busy = $state(false);
  let deleteForm = $state<HTMLFormElement | null>(null);
  let confirmOpen = $state(false);
  let target = $state<SystemTagRow | null>(null);

  let tags = $state<SystemTagRow[]>([]);
  let nextOffset = $state(0);
  let hasMore = $state(false);
  let total = $state(0);
  let loadingMore = $state(false);
  let listError = $state<string | null>(null);
  let scrollRoot = $state<HTMLDivElement | null>(null);
  let sentinel = $state<HTMLDivElement | null>(null);
  let fetchGen = 0;

  $effect(() => {
    tags = [...data.tags];
    nextOffset = data.nextOffset;
    hasMore = data.hasMore;
    total = data.total;
    listError = null;
    scrollRoot?.scrollTo({ top: 0 });
  });

  function askDelete(tag: SystemTagRow) {
    target = tag;
    confirmOpen = true;
  }

  async function loadMore() {
    if (!hasMore || loadingMore) return;
    const gen = ++fetchGen;
    const offset = nextOffset;
    loadingMore = true;
    listError = null;
    try {
      const params = new URLSearchParams();
      params.set("offset", String(offset));
      const res = await fetch(`/api/admin/tags?${params}`, {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error(`Failed to load tags (${res.status})`);
      const body = (await res.json()) as { tags: SystemTagRow[]; hasMore: boolean; nextOffset: number; total: number };
      if (gen !== fetchGen) return;
      const seen = new Set(tags.map((t) => t.id));
      tags = [...tags, ...body.tags.filter((t) => !seen.has(t.id))];
      hasMore = body.hasMore;
      nextOffset = body.nextOffset;
      total = body.total;
    } catch (err) {
      if (gen !== fetchGen) return;
      listError = err instanceof Error ? err.message : "Failed to load tags";
    } finally {
      if (gen === fetchGen) loadingMore = false;
    }
  }

  $effect(() => {
    if (!sentinel || !scrollRoot) return;
    const el = sentinel;
    void tags.length;
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

  const deleteBody = $derived(
    target
      ? target.songCount > 0
        ? `"${target.name}" is on ${target.songCount} song(s) for ${target.userCount} user(s). Removing it untags them everywhere. Songs and private custom tags are not deleted.`
        : `"${target.name}" isn't used yet. It disappears from every tag picker.`
      : ""
  );
</script>

<div class="flex min-h-0 flex-1 flex-col gap-4">
  {#if form?.error}
    <p class="auth-error shrink-0">{form.error}</p>
  {:else if form && "ok" in form && form.ok}
    <p class="shrink-0 text-sm text-signal">{form.ok}</p>
  {/if}

  <form
    method="POST"
    action="?/create"
    class="shrink-0 space-y-3 rounded-lg border border-border/70 bg-card/50 p-4"
    use:enhance={() => {
      busy = true;
      return async ({ result, update }) => {
        await update({ reset: false });
        busy = false;
        if (result.type === "success") name = "";
      };
    }}
  >
    <div>
      <h2 class="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">Add system tag</h2>
      <p class="mt-1 text-sm text-muted-foreground">
        System tags show in everyone’s tag picker. Custom tags stay private to the person who made them and aren’t managed here.
      </p>
    </div>
    <div class="flex flex-col gap-2 sm:flex-row">
      <input class="auth-field sm:max-w-xs" name="name" placeholder="e.g. chill" maxlength="64" autocomplete="off" bind:value={name} />
      <button type="submit" class="auth-btn inline-flex w-fit items-center gap-1.5" disabled={!name.trim() || busy}>
        <PlusIcon class="size-3.5" aria-hidden="true" />
        Add tag
      </button>
    </div>
  </form>

  <div class="flex min-h-0 flex-1 flex-col gap-3">
    <h2 class="shrink-0 font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">System tags ({total})</h2>
    {#if listError}
      <p class="auth-error mb-0 shrink-0 p-2">{listError}</p>
    {/if}
    {#if tags.length === 0}
      <p class="rounded border border-dashed border-border/70 px-4 py-6 text-center text-sm text-muted-foreground">No system tags.</p>
    {:else}
      <div bind:this={scrollRoot} class="zap-track-host min-h-0 flex-1 overflow-y-auto overscroll-contain p-3" role="region" aria-label="System tags">
        <ul class="flex flex-wrap gap-2">
          {#each tags as tag (tag.id)}
            <li>
              <span
                class="inline-flex max-w-full items-center gap-1 border border-signal/40 bg-signal/10 py-1 pr-1 pl-2.5 font-mono text-[11px] text-signal"
                title={`${tag.songCount} song(s) · ${tag.userCount} user(s)${tag.customTwins ? ` · ${tag.customTwins} private twin(s)` : ""}`}
              >
                <span class="truncate">{tag.name}</span>
                {#if tag.songCount > 0}
                  <span class="font-mono text-[10px] text-signal/70 tabular-nums">{tag.songCount}</span>
                {/if}
                <button
                  type="button"
                  class="inline-flex size-5 shrink-0 items-center justify-center text-signal/70 hover:bg-signal/20 hover:text-signal disabled:opacity-40"
                  aria-label={`Remove ${tag.name}`}
                  title="Remove tag"
                  disabled={busy}
                  onclick={() => askDelete(tag)}
                >
                  <XIcon class="size-3" aria-hidden="true" />
                </button>
              </span>
            </li>
          {/each}
        </ul>
        <div bind:this={sentinel} class="h-8" aria-hidden="true"></div>
        {#if loadingMore}
          <p class="px-1 pb-1 font-mono text-[10px] text-muted-foreground">Loading more…</p>
        {:else if !hasMore}
          <p class="px-1 pb-1 font-mono text-[10px] text-muted-foreground">End of tags</p>
        {/if}
      </div>
    {/if}
  </div>
</div>

<form
  method="POST"
  action="?/delete"
  class="hidden"
  bind:this={deleteForm}
  use:enhance={() => {
    busy = true;
    return async ({ update }) => {
      await update();
      busy = false;
      confirmOpen = false;
    };
  }}
>
  <input type="hidden" name="tagId" value={target?.id ?? ""} />
</form>

<ConfirmDialog
  bind:open={confirmOpen}
  title={target ? `Remove "${target.name}"?` : "Remove tag?"}
  body={deleteBody}
  confirmLabel="Remove tag"
  danger
  {busy}
  onconfirm={() => deleteForm?.requestSubmit()}
/>
