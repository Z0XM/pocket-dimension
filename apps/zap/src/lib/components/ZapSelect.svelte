<script lang="ts">
  import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
  import CheckIcon from "@lucide/svelte/icons/check";

  type Option = { value: string; label: string };

  let {
    options,
    value = $bindable(""),
    placeholder = "Select…",
    disabled = false,
    onChange,
  }: {
    options: Option[];
    value?: string;
    placeholder?: string;
    disabled?: boolean;
    onChange?: (value: string) => void;
  } = $props();

  let open = $state(false);
  let rootEl = $state<HTMLDivElement | null>(null);

  const selected = $derived(options.find((o) => o.value === value) ?? null);

  function pick(next: string) {
    value = next;
    open = false;
    onChange?.(next);
  }

  function onDocPointerDown(e: PointerEvent) {
    if (!open || !rootEl) return;
    if (!rootEl.contains(e.target as Node)) open = false;
  }

  function toggleOpen(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    open = !open;
  }

  $effect(() => {
    if (!open) return;
    const id = window.setTimeout(() => {
      document.addEventListener("pointerdown", onDocPointerDown);
    }, 0);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("pointerdown", onDocPointerDown);
    };
  });
</script>

<div class="zap-select relative w-full" bind:this={rootEl}>
  <button
    type="button"
    class="auth-field flex w-full items-center justify-between gap-2 text-left"
    {disabled}
    aria-haspopup="listbox"
    aria-expanded={open}
    onclick={toggleOpen}
  >
    <span class={`min-w-0 truncate ${selected ? "text-foreground" : "text-muted-foreground"}`}>
      {selected?.label ?? placeholder}
    </span>
    <ChevronDownIcon class={`size-4 shrink-0 text-muted-foreground transition ${open ? "rotate-180" : ""}`} />
  </button>

  {#if open}
    <div
      class="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded border border-border bg-popover shadow-[0_0_0_1px_color-mix(in_srgb,var(--signal)_12%,transparent)]"
      role="listbox"
    >
      <button
        type="button"
        role="option"
        aria-selected={!value}
        class={`flex w-full items-center gap-2 px-3 py-2 text-left font-mono text-xs transition hover:bg-signal/10 ${!value ? "text-signal" : "text-muted-foreground"}`}
        onclick={() => pick("")}
      >
        <span class={`flex size-4 items-center justify-center rounded border ${!value ? "border-signal bg-signal/20" : "border-border"}`}>
          {#if !value}
            <CheckIcon class="size-3" />
          {/if}
        </span>
        <span class="flex-1 truncate">{placeholder}</span>
      </button>
      {#each options as opt}
        {@const isOn = value === opt.value}
        <button
          type="button"
          role="option"
          aria-selected={isOn}
          class={`flex w-full items-center gap-2 px-3 py-2 text-left font-mono text-xs transition hover:bg-signal/10 ${isOn ? "text-signal" : "text-muted-foreground"}`}
          onclick={() => pick(opt.value)}
        >
          <span class={`flex size-4 items-center justify-center rounded border ${isOn ? "border-signal bg-signal/20" : "border-border"}`}>
            {#if isOn}
              <CheckIcon class="size-3" />
            {/if}
          </span>
          <span class="flex-1 truncate">{opt.label}</span>
        </button>
      {:else}
        <p class="px-3 py-2 text-xs text-muted-foreground">No options.</p>
      {/each}
    </div>
  {/if}
</div>
