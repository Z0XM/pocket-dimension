<script lang="ts">
  import SearchIcon from "@lucide/svelte/icons/search";
  import { filterTagIconCategories, systemTagIconCount } from "$lib/tag-icons";

  let {
    value = $bindable<string | null>(null),
    name = "icon",
    disabled = false,
    compact = false,
  }: {
    value?: string | null;
    name?: string;
    disabled?: boolean;
    /** Tighter grid for inline edit popovers. */
    compact?: boolean;
  } = $props();

  let query = $state("");
  const categories = $derived(filterTagIconCategories(query));
  const total = systemTagIconCount();
  const shown = $derived(categories.reduce((n, c) => n + c.icons.length, 0));

  function pick(icon: string) {
    if (disabled) return;
    value = value === icon ? null : icon;
  }
</script>

<input type="hidden" {name} value={value ?? ""} />

<div class={`space-y-3 ${compact ? "max-h-72 overflow-y-auto overscroll-contain pr-1" : ""}`}>
  <div class="flex flex-wrap items-center gap-2">
    <span class="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">Icon</span>
    {#if value}
      <span class="inline-flex items-center gap-1.5 rounded border border-signal/40 bg-signal/10 px-2 py-0.5 font-mono text-[11px] text-signal">
        <span class="text-base leading-none" aria-hidden="true">{value}</span>
        selected
        <button type="button" class="text-signal/70 hover:text-signal disabled:opacity-40" {disabled} onclick={() => (value = null)}>
          clear
        </button>
      </span>
    {:else}
      <span class="font-mono text-[10px] text-muted-foreground">optional · {total} icons</span>
    {/if}
  </div>

  <div class="relative">
    <SearchIcon class="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
    <input
      class="auth-field w-full pl-8 font-mono text-xs"
      type="search"
      placeholder="Search icons… mood, music, fire, india"
      aria-label="Search icons"
      autocomplete="off"
      {disabled}
      bind:value={query}
    />
  </div>

  {#if categories.length === 0}
    <p class="rounded border border-dashed border-border/60 px-3 py-4 text-center text-xs text-muted-foreground">
      No icons match “{query.trim()}”.
    </p>
  {:else}
    {#if query.trim()}
      <p class="font-mono text-[10px] text-muted-foreground">{shown} match{shown === 1 ? "" : "es"}</p>
    {/if}
    {#each categories as cat (cat.id)}
      <div>
        <p class="mb-1.5 font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">{cat.label}</p>
        <div class={`grid gap-1 ${compact ? "grid-cols-8" : "grid-cols-8 sm:grid-cols-10 md:grid-cols-12"}`}>
          {#each cat.icons as icon (icon.glyph)}
            <button
              type="button"
              class={`inline-flex aspect-square items-center justify-center rounded border text-lg leading-none transition ${
                value === icon.glyph
                  ? "border-signal bg-signal/15 text-foreground"
                  : "border-border/70 bg-background/40 hover:border-signal/50 hover:bg-signal/10"
              } disabled:opacity-40`}
              title={`${icon.glyph} · ${icon.keys.split(" ").slice(0, 4).join(" ")}`}
              aria-label={`Icon ${icon.glyph}`}
              aria-pressed={value === icon.glyph}
              {disabled}
              onclick={() => pick(icon.glyph)}
            >
              {icon.glyph}
            </button>
          {/each}
        </div>
      </div>
    {/each}
  {/if}
</div>
