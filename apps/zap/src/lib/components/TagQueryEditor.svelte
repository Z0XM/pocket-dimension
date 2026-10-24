<script lang="ts">
  import CheckIcon from "@lucide/svelte/icons/check";
  import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
  import XIcon from "@lucide/svelte/icons/x";
  import { rankTopTagIds, type TagFilterTag } from "$lib/tag-filter";
  import { measureDropdownPlacement, type DropdownPlacement } from "$lib/utils/dropdown-placement";

  let {
    tagQuery = $bindable(""),
    selectedTagIds = $bindable<string[]>([]),
    untagged = $bindable(false),
    availableTags = [],
    topTagIds,
    tagQueryError = null,
    layout = "stack",
    compact = false,
    onchange,
  }: {
    tagQuery?: string;
    selectedTagIds?: string[];
    /** Filter to tracks with no tags for this user. */
    untagged?: boolean;
    availableTags?: TagFilterTag[];
    /** Tags shown as chips; the rest live in the “More” dropdown. Defaults to system tags by name. */
    topTagIds?: string[];
    tagQueryError?: string | null;
    /** `grid`: query and tags side by side (catalogue panel). `stack`: query above tags. */
    layout?: "grid" | "stack";
    compact?: boolean;
    /** Fired on chip changes immediately and on typing after a short debounce. */
    onchange?: () => void;
  } = $props();

  const fieldId = $props.id();
  const queryMode = $derived(Boolean(tagQuery.trim()));
  const tagById = $derived(new Map(availableTags.map((t) => [t.id, t])));
  const visibleIds = $derived(
    (topTagIds ?? rankTopTagIds(availableTags, { userCounts: new Map(), globalCounts: new Map() })).filter((id) => tagById.has(id))
  );
  const visibleTags = $derived(visibleIds.map((id) => tagById.get(id)!));
  const moreTags = $derived(availableTags.filter((t) => !visibleIds.includes(t.id)));
  const extraSelected = $derived(
    queryMode || untagged ? [] : selectedTagIds.filter((id) => !visibleIds.includes(id) && tagById.has(id)).map((id) => tagById.get(id)!)
  );
  const moreSelectedCount = $derived(
    queryMode ? 0 : (untagged ? 1 : 0) + moreTags.filter((t) => selectedTagIds.includes(t.id)).length
  );

  let tagQueryInput = $state<HTMLInputElement | null>(null);
  let typingTimer: ReturnType<typeof setTimeout> | null = null;

  let moreOpen = $state(false);
  let moreFilter = $state("");
  let moreRoot = $state<HTMLDivElement | null>(null);
  let moreTrigger = $state<HTMLButtonElement | null>(null);
  let morePlacement = $state<DropdownPlacement>({ openUp: false, maxHeightPx: 224 });
  const moreFiltered = $derived.by(() => {
    const needle = moreFilter.trim().toLowerCase();
    if (!needle) return moreTags;
    return moreTags.filter((t) => t.name.toLowerCase().includes(needle) || t.slug?.toLowerCase().includes(needle));
  });

  function emitSoon(ms = 320) {
    if (typingTimer) clearTimeout(typingTimer);
    typingTimer = setTimeout(() => onchange?.(), ms);
  }

  function onTagQueryInput() {
    if (tagQuery.trim()) {
      selectedTagIds = [];
      untagged = false;
    }
    emitSoon();
  }

  function clearTagQuery() {
    if (!tagQuery && !tagQueryError) return;
    tagQuery = "";
    onchange?.();
  }

  function toggleUntagged() {
    if (queryMode) {
      tagQuery = "";
    }
    const next = !untagged;
    untagged = next;
    if (next) selectedTagIds = [];
    moreOpen = false;
    onchange?.();
  }

  function insertIntoTagQuery(piece: string) {
    const el = tagQueryInput;
    const cur = tagQuery;
    const start = el?.selectionStart ?? cur.length;
    const end = el?.selectionEnd ?? cur.length;
    const before = cur.slice(0, start);
    const after = cur.slice(end);
    const needsSpaceBefore = before.length > 0 && !/\s$/.test(before) && !/[(\[]$/.test(before);
    const needsSpaceAfter = after.length > 0 && !/^\s/.test(after) && !/^[)\]]/.test(after);
    tagQuery = `${before}${needsSpaceBefore ? " " : ""}${piece}${needsSpaceAfter ? " " : ""}${after}`;
    selectedTagIds = [];
    untagged = false;
    queueMicrotask(() => {
      if (!el) return;
      const pos = before.length + (needsSpaceBefore ? 1 : 0) + piece.length + (needsSpaceAfter ? 1 : 0);
      el.focus();
      el.setSelectionRange(pos, pos);
    });
    emitSoon();
  }

  function toggleTag(id: string) {
    const tag = tagById.get(id);
    if (!tag) return;
    if (queryMode) {
      // The DSL only tokenizes [A-Za-z0-9_-], so insert the slug for names with spaces.
      insertIntoTagQuery(tag.slug || tag.name);
      moreOpen = false;
      return;
    }
    untagged = false;
    selectedTagIds = selectedTagIds.includes(id) ? selectedTagIds.filter((t) => t !== id) : [...selectedTagIds, id];
    onchange?.();
  }

  function refreshMorePlacement() {
    if (moreTrigger) morePlacement = measureDropdownPlacement(moreTrigger, 260);
  }

  function toggleMore(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!moreOpen) {
      moreFilter = "";
      refreshMorePlacement();
    }
    moreOpen = !moreOpen;
  }

  $effect(() => {
    if (!moreOpen) return;
    refreshMorePlacement();
    const onDocPointerDown = (e: PointerEvent) => {
      if (moreRoot && !moreRoot.contains(e.target as Node)) moreOpen = false;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") moreOpen = false;
    };
    const onResize = () => refreshMorePlacement();
    const id = window.setTimeout(() => document.addEventListener("pointerdown", onDocPointerDown), 0);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("pointerdown", onDocPointerDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  });

  const chipClass = $derived(compact || layout === "grid" ? "px-2.5 py-0.5 text-[11px]" : "px-3 py-1 text-xs");
</script>

{#snippet queryOps()}
  {#each ["and", "or", "not", "(", ")"] as kw}
    <button
      type="button"
      class="rounded border border-border px-2 py-0.5 font-mono text-[10px] text-muted-foreground hover:border-signal hover:text-signal"
      onclick={() => insertIntoTagQuery(kw)}
    >
      {kw}
    </button>
  {/each}
  {#if tagQuery.trim()}
    <button
      type="button"
      class="rounded border border-border px-2 py-0.5 font-mono text-[10px] text-muted-foreground hover:border-signal hover:text-signal"
      onclick={clearTagQuery}
    >
      clear
    </button>
  {/if}
{/snippet}

{#snippet queryField(extraClass: string)}
  <input
    id={`${fieldId}-tag-query`}
    class={`auth-field font-mono text-sm ${extraClass}`}
    type="search"
    placeholder="love and (soft not upbeat)"
    title={queryMode ? "Nested filter active — chips insert tag names." : "Optional. Chips AND together when this is empty."}
    bind:this={tagQueryInput}
    bind:value={tagQuery}
    oninput={onTagQueryInput}
    autocomplete="off"
    spellcheck="false"
  />
{/snippet}

{#snippet chips()}
  <div class="flex flex-wrap items-center gap-1.5">
    {#if untagged && !queryMode}
      <button
        type="button"
        class={`zap-tag-chip zap-tag-chip-on inline-flex items-center gap-1 font-mono ${chipClass}`}
        aria-pressed="true"
        aria-label="Clear untagged filter"
        title="Clear"
        onclick={toggleUntagged}
      >
        Untagged
        <XIcon class="size-3" aria-hidden="true" />
      </button>
    {/if}
    {#each visibleTags as tag (tag.id)}
      {@const isOn = !queryMode && !untagged && selectedTagIds.includes(tag.id)}
      <button
        type="button"
        class={`zap-tag-chip font-mono ${chipClass} ${isOn ? "zap-tag-chip-on" : ""}`}
        aria-pressed={isOn}
        onclick={() => toggleTag(tag.id)}
      >
        {tag.name}
      </button>
    {/each}
    {#each extraSelected as tag (tag.id)}
      <button
        type="button"
        class={`zap-tag-chip zap-tag-chip-on inline-flex items-center gap-1 font-mono ${chipClass}`}
        aria-pressed="true"
        aria-label={`Remove tag ${tag.name}`}
        title="Remove"
        onclick={() => toggleTag(tag.id)}
      >
        {tag.name}
        <XIcon class="size-3" aria-hidden="true" />
      </button>
    {/each}

    <div class="relative" bind:this={moreRoot}>
      <button
        type="button"
        class={`zap-tag-chip inline-flex items-center gap-1 border-dashed font-mono ${chipClass} ${
          moreOpen || moreSelectedCount ? "zap-tag-chip-on border-dashed" : ""
        }`}
        bind:this={moreTrigger}
        aria-haspopup="listbox"
        aria-expanded={moreOpen}
        onclick={toggleMore}
      >
        {visibleTags.length ? "More" : "Tags"}
        <span class="tabular-nums opacity-70">
          {#if moreSelectedCount}
            {moreSelectedCount}{#if moreTags.length}/{moreTags.length + 1}{:else}/1{/if}
          {:else}
            {moreTags.length + 1}
          {/if}
        </span>
        <ChevronDownIcon class={`size-3 transition ${moreOpen ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>

      {#if moreOpen}
        <div
          class={`absolute left-0 z-50 flex w-56 flex-col overflow-hidden rounded border border-border bg-popover shadow-[0_0_0_1px_color-mix(in_srgb,var(--signal)_12%,transparent)] ${
            morePlacement.openUp ? "bottom-full mb-1" : "top-full mt-1"
          }`}
          style={`max-height: ${morePlacement.maxHeightPx}px`}
        >
          {#if moreTags.length > 8}
            <input
              class="m-1.5 shrink-0 rounded border border-border bg-background px-2 py-1 font-mono text-xs outline-none focus:border-signal"
              type="search"
              placeholder="Filter tags…"
              aria-label="Filter tags"
              bind:value={moreFilter}
              autocomplete="off"
            />
          {/if}
          <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain" role="listbox" aria-multiselectable={!queryMode}>
            <button
              type="button"
              role="option"
              aria-selected={!queryMode && untagged}
              class={`flex w-full items-center gap-2 border-b border-border/50 px-3 py-1.5 text-left font-mono text-xs transition hover:bg-signal/10 ${
                !queryMode && untagged ? "text-signal" : "text-muted-foreground"
              }`}
              onclick={toggleUntagged}
            >
              <span
                class={`flex size-4 shrink-0 items-center justify-center rounded border ${
                  !queryMode && untagged ? "border-signal bg-signal/20" : "border-border"
                }`}
              >
                {#if !queryMode && untagged}
                  <CheckIcon class="size-3" />
                {/if}
              </span>
              <span class="min-w-0 flex-1 truncate">Untagged</span>
              <span class="text-[10px] uppercase opacity-60">filter</span>
            </button>
            {#each moreFiltered as tag (tag.id)}
              {@const isOn = !queryMode && !untagged && selectedTagIds.includes(tag.id)}
              <button
                type="button"
                role="option"
                aria-selected={isOn}
                class={`flex w-full items-center gap-2 px-3 py-1.5 text-left font-mono text-xs transition hover:bg-signal/10 ${isOn ? "text-signal" : "text-muted-foreground"}`}
                onclick={() => toggleTag(tag.id)}
              >
                <span
                  class={`flex size-4 shrink-0 items-center justify-center rounded border ${isOn ? "border-signal bg-signal/20" : "border-border"}`}
                >
                  {#if isOn}
                    <CheckIcon class="size-3" />
                  {/if}
                </span>
                <span class="min-w-0 flex-1 truncate">{tag.name}</span>
                <span class="text-[10px] uppercase opacity-60">{tag.kind}</span>
              </button>
            {:else}
              {#if moreFilter.trim()}
                <p class="px-3 py-2 text-xs text-muted-foreground">No tags match.</p>
              {/if}
            {/each}
          </div>
        </div>
      {/if}
    </div>
  </div>
{/snippet}

{#if layout === "grid"}
  <div class="grid gap-x-3 gap-y-2 md:grid-cols-2">
    <div class="min-w-0 space-y-1.5">
      <div class="flex flex-wrap items-center gap-1">
        <label class="mr-1 font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase" for={`${fieldId}-tag-query`}>Tag query</label>
        {@render queryOps()}
      </div>
      {@render queryField("h-9 py-0")}
      {#if tagQueryError}
        <p class="auth-error mb-0 p-2 text-xs">{tagQueryError}</p>
      {/if}
    </div>
    <div class="min-w-0 space-y-1.5">
      <p class="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
        Tags{#if queryMode}<span class="normal-case tracking-normal"> · click inserts into query</span>{/if}
      </p>
      {@render chips()}
    </div>
  </div>
{:else}
  <div class="space-y-2">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <label class="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase" for={`${fieldId}-tag-query`}>Tag query</label>
      <div class="flex flex-wrap gap-1">
        {@render queryOps()}
      </div>
    </div>
    {@render queryField("")}
    {#if tagQueryError}
      <p class="auth-error text-xs">{tagQueryError}</p>
    {:else if !compact}
      <p class="font-mono text-[10px] text-muted-foreground">
        {#if queryMode}
          Nested filter active — chips insert tag names.
        {:else}
          Optional. Chips AND together when this is empty.
        {/if}
      </p>
    {/if}
    {@render chips()}
  </div>
{/if}
