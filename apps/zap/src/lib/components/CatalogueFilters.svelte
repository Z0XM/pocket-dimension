<script lang="ts">
  import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
  import SearchIcon from "@lucide/svelte/icons/search";
  import SlidersHorizontalIcon from "@lucide/svelte/icons/sliders-horizontal";
  import type { Snippet } from "svelte";

  type TagOpt = { id: string; name: string; kind: string };

  let {
    scope = $bindable<"all" | "yours">("all"),
    q = $bindable(""),
    tagQuery = $bindable(""),
    selectedTagIds = $bindable<string[]>([]),
    open = $bindable(true),
    availableTags = [],
    tagQueryError = null,
    compact = false,
    collapsible = false,
    busy = false,
    actions,
    onchange,
  }: {
    scope?: "all" | "yours";
    q?: string;
    tagQuery?: string;
    selectedTagIds?: string[];
    /** Tag filter panel expanded (only used when `collapsible`). */
    open?: boolean;
    availableTags?: TagOpt[];
    tagQueryError?: string | null;
    /** Session “add” column — tighter chrome */
    compact?: boolean;
    /** Catalogue toolbar: scope + search + actions on one row, tag filters in a collapsible panel. */
    collapsible?: boolean;
    /** Refetch in flight — subtle signal on filters */
    busy?: boolean;
    /** Rendered at the end of the toolbar row (only used when `collapsible`). */
    actions?: Snippet;
    onchange?: () => void;
  } = $props();

  const panelId = $props.id();
  const activeTagFilters = $derived(tagQuery.trim() ? 1 : selectedTagIds.length);

  let tagQueryInput = $state<HTMLInputElement | null>(null);
  let searchTimer: ReturnType<typeof setTimeout> | null = null;

  function emitSoon(ms = 280) {
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => onchange?.(), ms);
  }

  function onScope(next: "all" | "yours") {
    if (scope === next) return;
    scope = next;
    onchange?.();
  }

  function onTagQueryInput() {
    if (tagQuery.trim()) selectedTagIds = [];
    emitSoon(320);
  }

  function clearTagQuery() {
    if (!tagQuery && !tagQueryError) return;
    tagQuery = "";
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
    queueMicrotask(() => {
      if (!el) return;
      const pos = before.length + (needsSpaceBefore ? 1 : 0) + piece.length + (needsSpaceAfter ? 1 : 0);
      el.focus();
      el.setSelectionRange(pos, pos);
    });
    emitSoon(320);
  }

  function toggleTag(id: string) {
    if (tagQuery.trim()) {
      const tag = availableTags.find((t) => t.id === id);
      if (tag) insertIntoTagQuery(tag.name);
      return;
    }
    selectedTagIds = selectedTagIds.includes(id) ? selectedTagIds.filter((t) => t !== id) : [...selectedTagIds, id];
    onchange?.();
  }
</script>

{#snippet scopeButtons(sizeClass: string)}
  <button
    type="button"
    class={`rounded font-mono text-xs ${sizeClass} ${scope === "all" ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"}`}
    disabled={busy}
    aria-pressed={scope === "all"}
    onclick={() => onScope("all")}
  >
    All
  </button>
  <button
    type="button"
    class={`rounded font-mono text-xs whitespace-nowrap ${sizeClass} ${scope === "yours" ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"}`}
    disabled={busy}
    aria-pressed={scope === "yours"}
    onclick={() => onScope("yours")}
  >
    Your library
  </button>
{/snippet}

{#snippet tagQueryOps()}
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

{#snippet tagQueryField(extraClass: string)}
  <input
    id={`${panelId}-tag-query`}
    class={`auth-field font-mono text-sm ${extraClass}`}
    type="search"
    placeholder="love and (soft not upbeat)"
    title={tagQuery.trim() ? "Nested filter active — chips insert tag names." : "Optional. Chips AND together when this is empty."}
    bind:this={tagQueryInput}
    bind:value={tagQuery}
    oninput={onTagQueryInput}
    autocomplete="off"
    spellcheck="false"
  />
{/snippet}

{#snippet tagChips(chipClass: string)}
  {#each availableTags as tag}
    <button
      type="button"
      class={`rounded-full border font-mono ${chipClass} ${
        tagQuery.trim()
          ? "border-border text-muted-foreground hover:border-signal hover:text-signal"
          : selectedTagIds.includes(tag.id)
            ? "border-signal bg-signal/15 text-signal"
            : "border-border text-muted-foreground"
      }`}
      aria-pressed={!tagQuery.trim() && selectedTagIds.includes(tag.id)}
      onclick={() => toggleTag(tag.id)}
    >
      {tag.name}
    </button>
  {/each}
{/snippet}

{#if collapsible}
  <div class="flex flex-col gap-2" aria-busy={busy}>
    <div class="flex flex-wrap items-center gap-2">
      <div class="flex shrink-0 gap-1.5">
        {@render scopeButtons("h-9 px-3")}
      </div>
      <div class="relative min-w-[12rem] flex-1">
        <SearchIcon class="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <input
          class="auth-field h-9 py-0 pr-12 pl-8"
          type="search"
          placeholder="Search title or artists…"
          aria-label="Search catalogue"
          bind:value={q}
          oninput={() => emitSoon()}
          autocomplete="off"
        />
        <button
          type="button"
          class={`absolute top-1/2 right-1 inline-flex h-7 -translate-y-1/2 items-center gap-1 rounded px-1.5 ${
            open || activeTagFilters ? "text-signal" : "text-muted-foreground"
          } hover:bg-signal/10 hover:text-signal`}
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={open ? "Hide tag filters" : "Show tag filters"}
          title={open ? "Hide tag filters" : "Show tag filters"}
          onclick={() => (open = !open)}
        >
          <SlidersHorizontalIcon class="size-4" aria-hidden="true" />
          {#if activeTagFilters && !open}
            <span class="font-mono text-[10px] tabular-nums">{activeTagFilters}</span>
          {:else}
            <ChevronDownIcon class={`size-3 transition ${open ? "rotate-180" : ""}`} aria-hidden="true" />
          {/if}
        </button>
      </div>
      {@render actions?.()}
    </div>

    <div id={panelId} class="grid gap-x-3 gap-y-2 md:grid-cols-2" hidden={!open}>
      <div class="min-w-0 space-y-1.5">
        <div class="flex flex-wrap items-center gap-1">
          <label class="mr-1 font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase" for={`${panelId}-tag-query`}>Tag query</label>
          {@render tagQueryOps()}
        </div>
        {@render tagQueryField("h-9 py-0")}
        {#if tagQueryError}
          <p class="auth-error mb-0 p-2 text-xs">{tagQueryError}</p>
        {/if}
      </div>
      <div class="min-w-0 space-y-1.5">
        <p class="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
          Tags{#if tagQuery.trim()}<span class="normal-case tracking-normal"> · click inserts into query</span>{/if}
        </p>
        <div class="flex max-h-[4.5rem] flex-wrap content-start gap-1.5 overflow-y-auto">
          {@render tagChips("px-2.5 py-0.5 text-[11px]")}
          {#if availableTags.length === 0}
            <span class="font-mono text-[11px] text-muted-foreground">No tags yet — tag tracks to filter by them.</span>
          {/if}
        </div>
      </div>
    </div>
  </div>
{:else}
  <div class={`flex flex-col ${compact ? "gap-2" : "gap-4"}`} aria-busy={busy}>
    <div class="flex flex-wrap items-center gap-2">
      {@render scopeButtons("px-3 py-1.5")}
      {#if busy}
        <span class="inline-flex items-center gap-1.5 font-mono text-[10px] text-signal" role="status">
          <span class="zap-busy-bars scale-90" aria-hidden="true"><span></span><span></span><span></span></span>
          Updating
        </span>
      {/if}
    </div>

    <input
      class="auth-field"
      type="search"
      placeholder={compact ? "Search catalogue…" : "Search title or artists…"}
      bind:value={q}
      oninput={() => emitSoon()}
      autocomplete="off"
    />

    <div class="space-y-2">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <label class="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase" for={`${panelId}-tag-query`}> Tag query </label>
        <div class="flex flex-wrap gap-1">
          {@render tagQueryOps()}
        </div>
      </div>
      {@render tagQueryField("")}
      {#if tagQueryError}
        <p class="auth-error text-xs">{tagQueryError}</p>
      {:else if !compact}
        <p class="font-mono text-[10px] text-muted-foreground">
          {#if tagQuery.trim()}
            Nested filter active — chips insert tag names.
          {:else}
            Optional. Chips AND together when this is empty.
          {/if}
        </p>
      {/if}
    </div>

    <div class="flex flex-wrap gap-2">
      {@render tagChips("px-3 py-1 text-xs")}
    </div>
  </div>
{/if}
