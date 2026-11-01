<script lang="ts">
  import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
  import CheckIcon from "@lucide/svelte/icons/check";
  import { measureDropdownPlacement, type DropdownPlacement } from "$lib/utils/dropdown-placement";

  type Option = { value: string; label: string };

  let {
    options,
    value = $bindable(""),
    placeholder = "Select…",
    disabled = false,
    /** `field` = auth input chrome; `plain` = label + chevron only. */
    variant = "field",
    onChange,
  }: {
    options: Option[];
    value?: string;
    placeholder?: string;
    disabled?: boolean;
    variant?: "field" | "plain";
    onChange?: (value: string) => void;
  } = $props();

  let open = $state(false);
  let rootEl = $state<HTMLDivElement | null>(null);
  let triggerEl = $state<HTMLButtonElement | null>(null);
  let placement = $state<DropdownPlacement>({ openUp: false, maxHeightPx: 224 });

  const selected = $derived(options.find((o) => o.value === value) ?? null);

  function refreshPlacement() {
    if (!triggerEl) return;
    placement = measureDropdownPlacement(triggerEl);
  }

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
    if (!open) refreshPlacement();
    open = !open;
  }

  $effect(() => {
    if (!open) return;
    refreshPlacement();
    const onResize = () => refreshPlacement();
    const id = window.setTimeout(() => {
      document.addEventListener("pointerdown", onDocPointerDown);
    }, 0);
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("pointerdown", onDocPointerDown);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  });
</script>

<div class={`zap-select relative ${variant === "plain" ? "inline-flex w-auto max-w-full align-bottom" : "w-full"}`} bind:this={rootEl}>
  <button
    type="button"
    class={variant === "plain"
      ? "inline-flex max-w-full items-center gap-1 text-left font-mono text-[11px] leading-none text-muted-foreground hover:text-signal disabled:opacity-40"
      : "auth-field flex w-full items-center justify-between gap-2 text-left"}
    bind:this={triggerEl}
    {disabled}
    aria-haspopup="listbox"
    aria-expanded={open}
    onclick={toggleOpen}
  >
    <span class={`min-w-0 truncate ${selected || variant === "plain" ? "text-inherit" : "text-muted-foreground"}`}>
      {selected?.label ?? placeholder}
    </span>
    <ChevronDownIcon
      class={`shrink-0 transition ${variant === "plain" ? "size-3 text-muted-foreground" : "size-4 text-muted-foreground"} ${open ? "rotate-180" : ""}`}
    />
  </button>

  {#if open}
    <div
      class={`zap-dropdown absolute z-50 overflow-y-auto overscroll-contain ${
        variant === "plain" ? "min-w-[12rem] w-max max-w-[min(18rem,calc(100vw-2rem))]" : "w-full"
      } ${placement.openUp ? "is-up bottom-full mb-1" : "top-full mt-1"}`}
      style={`max-height: ${placement.maxHeightPx}px`}
      role="listbox"
    >
      <button
        type="button"
        role="option"
        aria-selected={!value}
        class={`flex w-full items-center gap-2 px-3 py-2 text-left font-mono text-xs transition ${!value ? "text-signal" : "text-muted-foreground"}`}
        onclick={() => pick("")}
      >
        <span class={`flex size-4 shrink-0 items-center justify-center rounded border ${!value ? "border-signal bg-signal/20" : "border-border"}`}>
          {#if !value}
            <CheckIcon class="size-3" />
          {/if}
        </span>
        <span class="min-w-0 flex-1 truncate">{placeholder}</span>
      </button>
      {#each options as opt}
        {@const isOn = value === opt.value}
        <button
          type="button"
          role="option"
          aria-selected={isOn}
          class={`flex w-full items-center gap-2 px-3 py-2 text-left font-mono text-xs transition ${isOn ? "text-signal" : "text-muted-foreground"}`}
          onclick={() => pick(opt.value)}
        >
          <span class={`flex size-4 shrink-0 items-center justify-center rounded border ${isOn ? "border-signal bg-signal/20" : "border-border"}`}>
            {#if isOn}
              <CheckIcon class="size-3" />
            {/if}
          </span>
          <span class="min-w-0 flex-1 truncate">{opt.label}</span>
        </button>
      {:else}
        <p class="px-3 py-2 text-xs text-muted-foreground">No options.</p>
      {/each}
    </div>
  {/if}
</div>
