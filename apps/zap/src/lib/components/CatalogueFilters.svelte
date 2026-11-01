<script lang="ts">
  import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
  import SearchIcon from "@lucide/svelte/icons/search";
  import type { Snippet } from "svelte";
  import TagQueryEditor from "$lib/components/TagQueryEditor.svelte";
  import ZapSelect from "$lib/components/ZapSelect.svelte";
  import type { TagFilterTag } from "$lib/tag-filter";

  let {
    scope = $bindable<"all" | "yours">("all"),
    libraryScope = $bindable(""),
    libraryScopeOptions,
    q = $bindable(""),
    tagQuery = $bindable(""),
    selectedTagIds = $bindable<string[]>([]),
    untagged = $bindable(false),
    open = $bindable(false),
    availableTags = [],
    topTagIds,
    tagQueryError = null,
    compact = false,
    collapsible = false,
    busy = false,
    actions,
    onchange,
  }: {
    scope?: "all" | "yours";
    /** Dropdown scope (catalogue toolbar): `""` = Your library, otherwise one of `libraryScopeOptions`. */
    libraryScope?: string;
    /** When set (with `collapsible`), a dropdown replaces the All / Your library buttons. */
    libraryScopeOptions?: { value: string; label: string }[];
    q?: string;
    tagQuery?: string;
    selectedTagIds?: string[];
    untagged?: boolean;
    /** Tag filter popover open (only used when `collapsible`). */
    open?: boolean;
    availableTags?: TagFilterTag[];
    /** Tags shown as chips; the rest are in a dropdown. */
    topTagIds?: string[];
    tagQueryError?: string | null;
    /** Session “add” column — tighter chrome */
    compact?: boolean;
    /** Catalogue toolbar: scope + search + actions; tag filters open in a popover. */
    collapsible?: boolean;
    /** Refetch in flight — subtle signal on filters */
    busy?: boolean;
    /** Rendered at the end of the toolbar row (only used when `collapsible`). */
    actions?: Snippet;
    onchange?: () => void;
  } = $props();

  const panelId = $props.id();
  const activeTagFilters = $derived(tagQuery.trim() ? 1 : untagged ? 1 : selectedTagIds.length);

  let searchTimer: ReturnType<typeof setTimeout> | null = null;
  let filtersTrigger = $state<HTMLButtonElement | null>(null);
  let filtersPanel = $state<HTMLDivElement | null>(null);

  function emitSoon(ms = 280) {
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => onchange?.(), ms);
  }

  function onScope(next: "all" | "yours") {
    if (scope === next) return;
    scope = next;
    onchange?.();
  }

  function toggleFilters() {
    open = !open;
  }

  function closeFilters() {
    open = false;
  }

  function onDocPointerDown(e: PointerEvent) {
    if (!open || !(e.target instanceof Node)) return;
    if (filtersTrigger?.contains(e.target) || filtersPanel?.contains(e.target)) return;
    closeFilters();
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === "Escape" && open) {
      e.preventDefault();
      closeFilters();
    }
  }
</script>

<svelte:document onpointerdown={onDocPointerDown} onkeydown={onKeydown} />

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
    Your Library
  </button>
{/snippet}

{#if collapsible}
  <div class="flex flex-col gap-1" aria-busy={busy}>
    <div class="relative flex flex-wrap items-end gap-3">
      {#if libraryScopeOptions}
        <div class="min-w-0 shrink leading-none" title="Browse scope">
          <ZapSelect
            variant="plain"
            options={libraryScopeOptions}
            bind:value={libraryScope}
            placeholder="Your Library"
            disabled={busy}
            onChange={() => onchange?.()}
          />
        </div>
      {:else}
        <div class="flex shrink-0 gap-1.5">
          {@render scopeButtons("h-9 px-3")}
        </div>
      {/if}
      <button
        type="button"
        bind:this={filtersTrigger}
        class={`inline-flex max-w-full shrink-0 items-center gap-1 text-left font-mono text-[11px] leading-none hover:text-signal ${
          open || activeTagFilters ? "text-signal" : "text-muted-foreground"
        }`}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={panelId}
        aria-label={open ? "Hide tag filters" : "Show tag filters"}
        title={open ? "Hide tag filters" : "Show tag filters"}
        onclick={toggleFilters}
      >
        <span>Filters</span>
        {#if activeTagFilters && !open}
          <span class="text-[10px] leading-none tabular-nums text-signal">{activeTagFilters}</span>
        {/if}
        <ChevronDownIcon class={`size-3 shrink-0 text-muted-foreground transition ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>

      {#if open}
        <div
          id={panelId}
          bind:this={filtersPanel}
          class="zap-dropdown absolute top-[calc(100%+0.4rem)] left-0 right-0 z-[70] p-3 sm:right-auto sm:w-[min(100%,28rem)]"
          role="dialog"
          aria-label="Tag filters"
        >
          <TagQueryEditor
            layout="stack"
            compact
            bind:tagQuery
            bind:selectedTagIds
            bind:untagged
            {availableTags}
            {topTagIds}
            {tagQueryError}
            {onchange}
          />
        </div>
      {/if}
    </div>
    <div class="flex flex-wrap items-center gap-2">
      <div class="relative min-w-[12rem] flex-1">
        <SearchIcon class="pointer-events-none absolute top-1/2 left-0 size-4 -translate-y-1/2 text-white" aria-hidden="true" />
        <input
          class="zap-underline-field h-9 py-0 pr-1 pl-7"
          type="search"
          placeholder="Search title or artists…"
          aria-label="Search catalogue"
          bind:value={q}
          oninput={() => emitSoon()}
          autocomplete="off"
        />
      </div>
      {@render actions?.()}
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

    <TagQueryEditor bind:tagQuery bind:selectedTagIds bind:untagged {availableTags} {topTagIds} {tagQueryError} {compact} {onchange} />
  </div>
{/if}
