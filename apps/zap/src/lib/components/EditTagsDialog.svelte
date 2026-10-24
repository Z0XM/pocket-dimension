<script lang="ts">
  import CheckIcon from "@lucide/svelte/icons/check";
  import SearchIcon from "@lucide/svelte/icons/search";
  import TagsIcon from "@lucide/svelte/icons/tags";
  import XIcon from "@lucide/svelte/icons/x";
  import { enhance } from "$app/forms";
  import { toast } from "$lib/toast.svelte";

  type TagOption = { id: string; name: string; kind: string };
  type SavedTag = { id: string; name: string; kind: string };

  let {
    open = $bindable(false),
    mediaAssetId,
    trackTitle,
    availableTags,
    initialSelected = [],
    onsaved,
  }: {
    open?: boolean;
    mediaAssetId: string;
    trackTitle: string;
    availableTags: TagOption[];
    initialSelected?: string[];
    onsaved?: (tags: SavedTag[]) => void;
  } = $props();

  let dialog = $state<HTMLDialogElement | null>(null);
  let formEl = $state<HTMLFormElement | null>(null);
  let filterEl = $state<HTMLInputElement | null>(null);
  let listEl = $state<HTMLDivElement | null>(null);
  let filter = $state("");
  let selected = $state<string[]>([]);
  let highlightIndex = $state(0);
  let busy = $state(false);

  const filteredOptions = $derived.by(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return availableTags;
    return availableTags.filter(
      (t) => t.name.toLowerCase().includes(needle) || t.kind.toLowerCase().includes(needle)
    );
  });

  const selectedTags = $derived(availableTags.filter((t) => selected.includes(t.id)));

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
    selected = [...initialSelected];
    filter = "";
    highlightIndex = 0;
    busy = false;
    queueMicrotask(() => filterEl?.focus());
  });

  $effect(() => {
    void filteredOptions.length;
    void filter;
    const n = filteredOptions.length;
    if (n === 0) highlightIndex = 0;
    else if (highlightIndex >= n) highlightIndex = n - 1;
    else if (highlightIndex < 0) highlightIndex = 0;
  });

  function toggle(id: string) {
    selected = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
  }

  function keepSearchFocus() {
    // List options are not in the tab order; still re-assert after scroll/toggle.
    queueMicrotask(() => filterEl?.focus({ preventScroll: true }));
  }

  function moveHighlight(delta: number) {
    const n = filteredOptions.length;
    if (n === 0) return;
    highlightIndex = (highlightIndex + delta + n) % n;
    queueMicrotask(() => {
      const el = listEl?.querySelector<HTMLElement>(`[data-tag-index="${highlightIndex}"]`);
      el?.scrollIntoView({ block: "nearest" });
      filterEl?.focus({ preventScroll: true });
    });
  }

  function toggleHighlighted() {
    const tag = filteredOptions[highlightIndex];
    if (tag) toggle(tag.id);
    keepSearchFocus();
  }

  /** Keyboard nav stays on the search input (aria-activedescendant highlights the list). */
  function onSearchKeydown(e: KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      e.stopPropagation();
      moveHighlight(1);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      moveHighlight(-1);
      return;
    }
    if (e.key === " " || e.code === "Space") {
      e.preventDefault();
      e.stopPropagation();
      toggleHighlighted();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      formEl?.requestSubmit();
    }
  }

  function close() {
    if (busy) return;
    open = false;
  }
</script>

<dialog
  bind:this={dialog}
  class="zap-dialog m-auto max-h-[min(calc(100dvh-2rem),32rem)] w-[min(calc(100%-2rem),26rem)] overflow-hidden rounded-lg border border-border bg-card p-0 text-card-foreground shadow-xl backdrop:bg-background/80 open:flex open:flex-col"
  onclose={() => {
    open = false;
  }}
  oncancel={(e) => {
    if (busy) e.preventDefault();
  }}
>
  <form
    bind:this={formEl}
    method="POST"
    action="?/setTags"
    class="flex min-h-0 flex-1 flex-col"
    use:enhance={() => {
      busy = true;
      return async ({ result, update }) => {
        await update({ reset: false, invalidateAll: false });
        busy = false;
        if (result.type === "failure") {
          const data = result.data as { tagError?: string } | undefined;
          toast.error(data?.tagError ?? "Could not update tags");
          return;
        }
        if (result.type !== "success") return;
        const data = result.data as { tagOk?: boolean; tags?: SavedTag[] } | undefined;
        if (data?.tagOk && Array.isArray(data.tags)) {
          onsaved?.(data.tags);
          toast.success("Tags updated.");
          open = false;
        }
      };
    }}
  >
    <input type="hidden" name="mediaAssetId" value={mediaAssetId} />
    {#each selected as id}
      <input type="hidden" name="tagIds" value={id} />
    {/each}

    <div class="flex shrink-0 items-start justify-between gap-3 border-b border-border/70 px-4 py-3">
      <div class="min-w-0">
        <h2 class="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <TagsIcon class="size-4 shrink-0 text-signal" aria-hidden="true" />
          Edit tags
        </h2>
        <p class="mt-0.5 truncate font-mono text-[11px] text-muted-foreground" title={trackTitle}>{trackTitle}</p>
      </div>
      <button
        type="button"
        class="inline-flex size-7 shrink-0 items-center justify-center rounded border border-border text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-40"
        aria-label="Close"
        disabled={busy}
        onclick={close}
      >
        <XIcon class="size-3.5" aria-hidden="true" />
      </button>
    </div>

    <div class="flex min-h-0 flex-1 flex-col gap-2 p-4">
      {#if selectedTags.length > 0}
        <div class="flex flex-wrap gap-1">
          {#each selectedTags as tag (tag.id)}
            <button
              type="button"
              class="inline-flex items-center gap-1 rounded-full border border-signal/40 bg-signal/10 px-2 py-0.5 font-mono text-[10px] text-signal hover:bg-signal/20"
              title={`Remove ${tag.name}`}
              disabled={busy}
              onmousedown={(e) => e.preventDefault()}
              onclick={() => {
                toggle(tag.id);
                keepSearchFocus();
              }}
            >
              {tag.name}
              <XIcon class="size-2.5" aria-hidden="true" />
            </button>
          {/each}
        </div>
      {/if}

      <div class="relative shrink-0">
        <SearchIcon
          class="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          bind:this={filterEl}
          class="auth-field w-full pl-8 font-mono text-xs"
          type="search"
          placeholder="Search tags… · ↑↓ · Space · Enter"
          aria-label="Search tags"
          aria-controls="edit-tags-listbox"
          aria-autocomplete="list"
          aria-activedescendant={filteredOptions[highlightIndex] ? `edit-tag-opt-${filteredOptions[highlightIndex]!.id}` : undefined}
          bind:value={filter}
          autocomplete="off"
          disabled={busy}
          onkeydown={onSearchKeydown}
        />
      </div>

      <div
        bind:this={listEl}
        id="edit-tags-listbox"
        class="min-h-[12rem] flex-1 overflow-y-auto overscroll-contain rounded border border-border/70 bg-background/40"
        role="listbox"
        aria-multiselectable="true"
        aria-label="Tags"
      >
        {#each filteredOptions as tag, index (tag.id)}
          {@const isOn = selected.includes(tag.id)}
          {@const isHi = index === highlightIndex}
          <div
            id={`edit-tag-opt-${tag.id}`}
            data-tag-index={index}
            role="option"
            tabindex="-1"
            aria-selected={isOn}
            class={`flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left font-mono text-xs transition ${
              isHi ? "bg-signal/15 text-signal" : isOn ? "text-signal hover:bg-signal/10" : "text-muted-foreground hover:bg-signal/10"
            }`}
            onmousedown={(e) => {
              // Keep the search input focused when picking with the mouse.
              e.preventDefault();
              if (busy) return;
              highlightIndex = index;
              toggle(tag.id);
              keepSearchFocus();
            }}
            onmouseenter={() => (highlightIndex = index)}
          >
            <span class={`flex size-4 items-center justify-center rounded border ${isOn ? "border-signal bg-signal/20" : "border-border"}`}>
              {#if isOn}
                <CheckIcon class="size-3" aria-hidden="true" />
              {/if}
            </span>
            <span class="min-w-0 flex-1 truncate">{tag.name}</span>
            <span class="text-[10px] uppercase opacity-60">{tag.kind}</span>
          </div>
        {:else}
          <p class="px-3 py-4 text-center text-xs text-muted-foreground">
            {availableTags.length === 0 ? "No tags available." : "No tags match."}
          </p>
        {/each}
      </div>
    </div>

    <div class="flex shrink-0 flex-wrap justify-end gap-2 border-t border-border/70 px-4 py-3">
      <button
        type="button"
        class="rounded border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-secondary disabled:opacity-40"
        disabled={busy}
        onclick={close}
      >
        Cancel
      </button>
      <button type="submit" class="auth-btn inline-flex items-center gap-1.5 disabled:opacity-40" disabled={busy}>
        <TagsIcon class="size-3.5" aria-hidden="true" />
        {busy ? "Saving…" : "Save"}
      </button>
    </div>
  </form>
</dialog>
