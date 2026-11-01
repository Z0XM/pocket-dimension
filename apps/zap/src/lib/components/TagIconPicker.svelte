<script lang="ts">
  import { TAG_ICON_CATEGORIES } from "$lib/tag-icons";

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

  function pick(icon: string) {
    if (disabled) return;
    value = value === icon ? null : icon;
  }
</script>

<input type="hidden" {name} value={value ?? ""} />

<div class={`space-y-3 ${compact ? "max-h-64 overflow-y-auto overscroll-contain pr-1" : ""}`}>
  <div class="flex flex-wrap items-center gap-2">
    <span class="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">Icon</span>
    {#if value}
      <span class="inline-flex items-center gap-1.5 rounded border border-signal/40 bg-signal/10 px-2 py-0.5 font-mono text-[11px] text-signal">
        <span class="text-base leading-none" aria-hidden="true">{value}</span>
        selected
        <button
          type="button"
          class="text-signal/70 hover:text-signal disabled:opacity-40"
          {disabled}
          onclick={() => (value = null)}
        >
          clear
        </button>
      </span>
    {:else}
      <span class="font-mono text-[10px] text-muted-foreground">optional</span>
    {/if}
  </div>

  {#each TAG_ICON_CATEGORIES as cat (cat.id)}
    <div>
      <p class="mb-1.5 font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">{cat.label}</p>
      <div class={`grid gap-1 ${compact ? "grid-cols-8" : "grid-cols-8 sm:grid-cols-10 md:grid-cols-12"}`}>
        {#each cat.icons as icon (icon)}
          <button
            type="button"
            class={`inline-flex aspect-square items-center justify-center rounded border text-lg leading-none transition ${
              value === icon
                ? "border-signal bg-signal/15 text-foreground"
                : "border-border/70 bg-background/40 hover:border-signal/50 hover:bg-signal/10"
            } disabled:opacity-40`}
            title={icon}
            aria-label={`Icon ${icon}`}
            aria-pressed={value === icon}
            {disabled}
            onclick={() => pick(icon)}
          >
            {icon}
          </button>
        {/each}
      </div>
    </div>
  {/each}
</div>
