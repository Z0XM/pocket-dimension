<script lang="ts">
  import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
  import CheckIcon from "@lucide/svelte/icons/check";

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
  let rootEl = $state<HTMLDivElement | null>(null);

  const selectedTags = $derived(options.filter((t) => selected.includes(t.id)));

  function toggle(id: string) {
    selected = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
  }

  function onDocPointerDown(e: PointerEvent) {
    if (!open || !rootEl) return;
    if (!rootEl.contains(e.target as Node)) open = false;
  }

  function toggleOpen(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    open = !open;
  }

  $effect(() => {
    if (!open) return;
    // Defer so the opening click doesn't immediately count as an outside click
    const id = window.setTimeout(() => {
      document.addEventListener("pointerdown", onDocPointerDown);
    }, 0);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("pointerdown", onDocPointerDown);
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
      class="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded border border-border bg-popover shadow-[0_0_0_1px_color-mix(in_srgb,var(--signal)_12%,transparent)]"
      role="listbox"
      aria-multiselectable="true"
    >
      {#each options as tag}
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
          <span class="flex-1">{tag.name}</span>
          <span class="text-[10px] uppercase opacity-60">{tag.kind}</span>
        </button>
      {:else}
        <p class="px-3 py-2 text-xs text-muted-foreground">No tags available.</p>
      {/each}
    </div>
  {/if}
</div>
