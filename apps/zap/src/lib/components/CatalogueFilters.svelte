<script lang="ts">
  import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
  import SearchIcon from "@lucide/svelte/icons/search";
  import SlidersHorizontalIcon from "@lucide/svelte/icons/sliders-horizontal";
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
    open = $bindable(true),
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
    /** Tag filter panel expanded (only used when `collapsible`). */
    open?: boolean;
    availableTags?: TagFilterTag[];
    /** Tags shown as chips; the rest are in a dropdown. */
    topTagIds?: string[];
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
  const activeTagFilters = $derived(tagQuery.trim() ? 1 : untagged ? 1 : selectedTagIds.length);

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

{#if collapsible}
  <div class="flex flex-col gap-2" aria-busy={busy}>
    <div class="flex flex-wrap items-center gap-2">
      {#if libraryScopeOptions}
        <div class="w-40 shrink-0 sm:w-48" title="Browse scope">
          <ZapSelect
            options={libraryScopeOptions}
            bind:value={libraryScope}
            placeholder="Your library"
            disabled={busy}
            onChange={() => onchange?.()}
          />
        </div>
      {:else}
        <div class="flex shrink-0 gap-1.5">
          {@render scopeButtons("h-9 px-3")}
        </div>
      {/if}
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

    <div id={panelId} hidden={!open}>
      <TagQueryEditor layout="grid" bind:tagQuery bind:selectedTagIds bind:untagged {availableTags} {topTagIds} {tagQueryError} {onchange} />
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
