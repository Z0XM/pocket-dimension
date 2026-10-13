<script lang="ts">
  type TagOpt = { id: string; name: string; kind: string };

  let {
    scope = $bindable<"all" | "yours">("all"),
    q = $bindable(""),
    tagQuery = $bindable(""),
    selectedTagIds = $bindable<string[]>([]),
    availableTags = [],
    tagQueryError = null,
    compact = false,
    busy = false,
    onchange,
  }: {
    scope?: "all" | "yours";
    q?: string;
    tagQuery?: string;
    selectedTagIds?: string[];
    availableTags?: TagOpt[];
    tagQueryError?: string | null;
    /** Session “add” column — tighter chrome */
    compact?: boolean;
    /** Refetch in flight — subtle signal on filters */
    busy?: boolean;
    onchange?: () => void;
  } = $props();

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

<div class={`flex flex-col ${compact ? "gap-2" : "gap-4"}`} aria-busy={busy}>
  <div class="flex flex-wrap items-center gap-2">
    <button
      type="button"
      class={`rounded px-3 py-1.5 font-mono text-xs ${scope === "all" ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"}`}
      disabled={busy}
      onclick={() => onScope("all")}
    >
      All
    </button>
    <button
      type="button"
      class={`rounded px-3 py-1.5 font-mono text-xs ${scope === "yours" ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"}`}
      disabled={busy}
      onclick={() => onScope("yours")}
    >
      Your library
    </button>
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
      <label class="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase" for="catalogue-tag-query"> Tag query </label>
      <div class="flex flex-wrap gap-1">
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
      </div>
    </div>
    <input
      id="catalogue-tag-query"
      class="auth-field font-mono text-sm"
      type="search"
      placeholder="love and (soft not upbeat)"
      bind:this={tagQueryInput}
      bind:value={tagQuery}
      oninput={onTagQueryInput}
      autocomplete="off"
      spellcheck="false"
    />
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
    {#each availableTags as tag}
      <button
        type="button"
        class={`rounded-full border px-3 py-1 font-mono text-xs ${
          tagQuery.trim()
            ? "border-border text-muted-foreground hover:border-signal hover:text-signal"
            : selectedTagIds.includes(tag.id)
              ? "border-signal bg-signal/15 text-signal"
              : "border-border text-muted-foreground"
        }`}
        onclick={() => toggleTag(tag.id)}
      >
        {tag.name}
      </button>
    {/each}
  </div>
</div>
