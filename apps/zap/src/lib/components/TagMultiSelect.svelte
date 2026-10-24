<script lang="ts">
  import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
  import CheckIcon from "@lucide/svelte/icons/check";
  import { measureDropdownPlacement, type DropdownPlacement } from "$lib/utils/dropdown-placement";

  type TagOption = { id: string; name: string; kind: string };

  let {
    options,
    selected = $bindable<string[]>([]),
    name = "tagIds",
    placeholder = "Select tags",
    disabled = false,
  }: {
    options: TagOption[];
    selected?: string[];
    name?: string;
    placeholder?: string;
    disabled?: boolean;
  } = $props();

  let open = $state(false);
  let filter = $state("");
  let rootEl = $state<HTMLDivElement | null>(null);
  let triggerEl = $state<HTMLButtonElement | null>(null);
  let filterEl = $state<HTMLInputElement | null>(null);
  let placement = $state<DropdownPlacement>({ openUp: false, maxHeightPx: 224 });

  const selectedTags = $derived(options.filter((t) => selected.includes(t.id)));
  const filteredOptions = $derived.by(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return options;
    return options.filter(
      (t) => t.name.toLowerCase().includes(needle) || t.kind.toLowerCase().includes(needle)
    );
  });

  function toggle(id: string) {
    selected = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
  }

  function refreshPlacement() {
    if (!triggerEl) return;
    placement = measureDropdownPlacement(triggerEl);
  }

  function onDocPointerDown(e: PointerEvent) {
    if (!open || !rootEl) return;
    if (!rootEl.contains(e.target as Node)) open = false;
  }

  function toggleOpen(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    if (!open) {
      filter = "";
      refreshPlacement();
    }
    open = !open;
  }

  $effect(() => {
    if (!open) return;
    refreshPlacement();
    queueMicrotask(() => filterEl?.focus());
    const onResize = () => refreshPlacement();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") open = false;
    };
    const id = window.setTimeout(() => {
      document.addEventListener("pointerdown", onDocPointerDown);
    }, 0);
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
</script>

<div class="zap-tag-select relative w-full" bind:this={rootEl}>
  {#each selected as id}
    <input type="hidden" {name} value={id} />
  {/each}

  <button
    type="button"
    class="auth-field flex w-full items-center justify-between gap-2 text-left"
    bind:this={triggerEl}
    {disabled}
    aria-haspopup="listbox"
    aria-expanded={open}
    onclick={toggleOpen}
  >
    <span class="flex min-w-0 flex-1 flex-wrap gap-1">
      {#if selectedTags.length === 0}
        <span class="text-muted-foreground">{placeholder}</span>
      {:else}
        {#each selectedTags as tag}
          <span class="rounded-full border border-signal/40 bg-signal/10 px-2 py-0.5 font-mono text-[10px] text-signal">
            {tag.name}
          </span>
        {/each}
      {/if}
    </span>
    <ChevronDownIcon class={`size-4 shrink-0 text-muted-foreground transition ${open ? "rotate-180" : ""}`} />
  </button>

  {#if open}
    <div
      class={`absolute z-50 flex w-full flex-col overflow-hidden rounded border border-border bg-popover shadow-[0_0_0_1px_color-mix(in_srgb,var(--signal)_12%,transparent)] ${
        placement.openUp ? "bottom-full mb-1" : "top-full mt-1"
      }`}
      style={`max-height: ${placement.maxHeightPx}px`}
    >
      <input
        class="m-1.5 shrink-0 rounded border border-border bg-background px-2 py-1.5 font-mono text-xs outline-none focus:border-signal"
        type="search"
        placeholder="Search tags…"
        aria-label="Search tags"
        bind:this={filterEl}
        bind:value={filter}
        autocomplete="off"
        onclick={(e) => e.stopPropagation()}
        onkeydown={(e) => e.stopPropagation()}
      />
      <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain" role="listbox" aria-multiselectable="true">
        {#each filteredOptions as tag (tag.id)}
          {@const isOn = selected.includes(tag.id)}
          <button
            type="button"
            role="option"
            aria-selected={isOn}
            class={`flex w-full items-center gap-2 px-3 py-2 text-left font-mono text-xs transition hover:bg-signal/10 ${isOn ? "text-signal" : "text-muted-foreground"}`}
            onclick={() => toggle(tag.id)}
          >
            <span class={`flex size-4 items-center justify-center rounded border ${isOn ? "border-signal bg-signal/20" : "border-border"}`}>
              {#if isOn}
                <CheckIcon class="size-3" />
              {/if}
            </span>
            <span class="min-w-0 flex-1 truncate">{tag.name}</span>
            <span class="text-[10px] uppercase opacity-60">{tag.kind}</span>
          </button>
        {:else}
          <p class="px-3 py-2 text-xs text-muted-foreground">
            {options.length === 0 ? "No tags available." : "No tags match."}
          </p>
        {/each}
      </div>
    </div>
  {/if}
</div>
