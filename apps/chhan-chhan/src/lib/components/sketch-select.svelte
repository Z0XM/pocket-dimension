<script lang="ts">
  type Option = {
    value: string;
    label: string;
  };

  type Props = {
    name: string;
    options: Option[];
    value?: string;
    /** When `multiple`, bind selected values here instead of `value`. */
    values?: string[];
    disabled?: boolean;
    compact?: boolean;
    multiple?: boolean;
    /** Show a filter field in the menu (matches option labels). */
    searchable?: boolean;
    searchPlaceholder?: string;
    emptyLabel?: string;
    /** Optional highlight color for compact trigger (e.g. category color). */
    accent?: string | null;
    /** Anchor the menu to the trigger's end edge (opens leftward). Useful near the right side of a clipped container. */
    alignEnd?: boolean;
    onChange?: (value: string) => void;
    "aria-label"?: string;
  };

  let {
    name,
    options,
    value = $bindable(""),
    values = $bindable<string[]>([]),
    disabled = false,
    compact = false,
    multiple = false,
    searchable = false,
    searchPlaceholder = "Search…",
    emptyLabel = "Pick…",
    accent = null,
    alignEnd = false,
    onChange,
    "aria-label": ariaLabel,
  }: Props = $props();

  let open = $state(false);
  let query = $state("");
  let root: HTMLDivElement | undefined = $state();
  let searchInput: HTMLInputElement | undefined = $state();

  const isEmpty = $derived(multiple ? values.length === 0 : !value);

  const selectedLabel = $derived.by(() => {
    if (multiple) {
      if (values.length === 0) return emptyLabel;
      if (values.length === 1) {
        return options.find((option) => option.value === values[0])?.label ?? "1 selected";
      }
      return `${values.length} selected`;
    }
    return options.find((option) => option.value === value)?.label ?? options[0]?.label ?? emptyLabel;
  });

  const filteredOptions = $derived.by(() => {
    const list = multiple ? options.filter((option) => option.value) : options;
    if (!searchable) return list;
    const needle = query.trim().toLowerCase();
    if (!needle) return list;
    return list.filter((option) => {
      if (!option.value) return true;
      return option.label.toLowerCase().includes(needle);
    });
  });

  function toggleOpen() {
    if (disabled) return;
    open = !open;
    if (!open) query = "";
  }

  function isSelected(optionValue: string) {
    if (multiple) return values.includes(optionValue);
    return optionValue === value;
  }

  function choose(next: string) {
    if (multiple) {
      if (!next) {
        values = [];
      } else if (values.includes(next)) {
        values = values.filter((id) => id !== next);
      } else {
        values = [...values, next];
      }
      onChange?.(next);
      return;
    }
    value = next;
    open = false;
    query = "";
    onChange?.(next);
  }

  $effect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node | null;
      if (root && target && !root.contains(target)) {
        open = false;
        query = "";
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        open = false;
        query = "";
      }
    }

    const timeout = window.setTimeout(() => {
      window.addEventListener("pointerdown", handlePointerDown);
      window.addEventListener("keydown", handleKeyDown);
      if (searchable) searchInput?.focus();
    }, 0);

    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  });
</script>

<div
  class="sketch-select"
  class:open
  class:disabled
  class:compact
  class:searchable
  class:multiple
  class:align-end={alignEnd}
  class:empty={isEmpty}
  class:has-accent={Boolean(accent && !isEmpty)}
  style={accent && !isEmpty ? `--sketch-accent: ${accent}` : undefined}
  bind:this={root}
>
  {#if multiple}
    {#each values as selected (selected)}
      <input type="hidden" name={`${name}[]`} value={selected} />
    {/each}
  {:else}
    <input type="hidden" {name} {value} />
  {/if}
  <button type="button" class="sketch-trigger" aria-expanded={open} aria-haspopup="listbox" aria-label={ariaLabel} {disabled} onclick={toggleOpen}>
    <span class="sketch-value">{selectedLabel}</span>
    <span class="sketch-caret" aria-hidden="true">▾</span>
  </button>

  {#if open}
    <div class="sketch-menu" role="presentation">
      {#if searchable}
        <div class="sketch-search">
          <input
            bind:this={searchInput}
            class="sketch-search-input"
            type="search"
            placeholder={searchPlaceholder}
            aria-label={ariaLabel ? `Search ${ariaLabel}` : "Search options"}
            bind:value={query}
            onclick={(e) => e.stopPropagation()}
            onkeydown={(e) => e.stopPropagation()}
          />
        </div>
      {/if}
      <ul class="sketch-options" role="listbox" aria-label={ariaLabel} aria-multiselectable={multiple || undefined}>
        {#each filteredOptions as option (option.value || option.label)}
          {@const selected = isSelected(option.value)}
          <li>
            <button
              type="button"
              role="option"
              class="sketch-option"
              class:selected
              class:empty={!option.value}
              aria-selected={selected}
              onclick={() => choose(option.value)}
            >
              <span class="dot" aria-hidden="true">{multiple ? (selected ? "✓" : "○") : "•"}</span>
              <span class="mark">{option.label}</span>
            </button>
          </li>
        {:else}
          <li class="sketch-empty">No matches</li>
        {/each}
      </ul>
      {#if multiple}
        <div class="sketch-multi-foot">
          <button type="button" class="sketch-done" onclick={() => ((open = false), (query = ""))}>Done</button>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .sketch-select {
    position: relative;
    width: 100%;
  }

  .sketch-select.compact {
    width: auto;
    display: inline-block;
    vertical-align: middle;
    max-width: 12rem;
  }

  .sketch-trigger {
    appearance: none;
    width: 100%;
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.5rem;
    background: transparent;
    border: none;
    border-bottom: 1.5px solid color-mix(in srgb, var(--ink) 32%, transparent);
    border-radius: 0;
    color: var(--ink);
    font-family: var(--hand);
    font-size: 0.95rem;
    padding: 0.05rem 0.1rem 0.28rem;
    cursor: pointer;
    text-align: left;
  }

  .sketch-select.compact .sketch-trigger {
    gap: 0.3rem;
    background: color-mix(in srgb, var(--yellow) 55%, transparent);
    border-bottom: none;
    border-radius: 2px 8px 3px 7px / 7px 2px 8px 2px;
    padding: 0.08rem 0.35rem 0.12rem 0.28rem;
    font-size: 1rem;
    transform: rotate(-0.5deg);
  }

  .sketch-select.compact.has-accent .sketch-trigger {
    background: color-mix(in srgb, var(--sketch-accent) 48%, var(--surface-raised));
  }

  .sketch-select.compact.empty .sketch-trigger {
    background: color-mix(in srgb, var(--ink) 5%, transparent);
    color: var(--ink-muted);
    transform: none;
  }

  .sketch-select.compact.empty .sketch-value,
  .sketch-select.compact.empty .sketch-caret {
    color: color-mix(in srgb, var(--ink-muted) 78%, transparent);
  }

  .sketch-trigger:hover:not(:disabled),
  .sketch-select.open .sketch-trigger {
    border-bottom-color: var(--brand);
  }

  .sketch-select.compact .sketch-trigger:hover:not(:disabled),
  .sketch-select.compact.open .sketch-trigger {
    background: color-mix(in srgb, var(--yellow) 78%, transparent);
    border-bottom-color: transparent;
  }

  .sketch-select.compact.has-accent .sketch-trigger:hover:not(:disabled),
  .sketch-select.compact.has-accent.open .sketch-trigger {
    background: color-mix(in srgb, var(--sketch-accent) 62%, var(--surface-raised));
  }

  .sketch-select.compact.empty .sketch-trigger:hover:not(:disabled),
  .sketch-select.compact.empty.open .sketch-trigger {
    background: color-mix(in srgb, var(--ink) 9%, transparent);
    color: var(--ink-muted);
  }

  .sketch-trigger:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .sketch-value {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sketch-caret {
    flex: none;
    color: var(--ink-muted);
    font-size: 0.85rem;
    line-height: 1;
  }

  .sketch-menu {
    margin: 0.2rem 0 0;
    padding: 0.35rem 0.25rem;
    position: absolute;
    left: 0;
    right: 0;
    z-index: 30;
    background: var(--surface-raised);
    border: 1.5px solid color-mix(in srgb, var(--ink) 28%, transparent);
    border-radius: 2px 6px 3px 2px;
    box-shadow:
      2px 2px 0 0 var(--shadow-paper),
      2px 2px 0 1.5px color-mix(in srgb, var(--ink) 16%, transparent);
    max-height: 16rem;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .sketch-select.compact .sketch-menu {
    right: auto;
    min-width: max(100%, 7.5rem);
    z-index: 40;
  }

  .sketch-select.searchable .sketch-menu {
    min-width: max(100%, 16rem);
  }

  .sketch-select.align-end .sketch-menu {
    left: auto;
    right: 0;
  }

  .sketch-search {
    flex: 0 0 auto;
    padding: 0.15rem 0.35rem 0.35rem;
    border-bottom: 1px dashed color-mix(in srgb, var(--ink) 14%, transparent);
    margin-bottom: 0.2rem;
  }

  .sketch-search-input {
    appearance: none;
    width: 100%;
    border: none;
    border-bottom: 1.5px solid color-mix(in srgb, var(--ink) 28%, transparent);
    background: transparent;
    font-family: var(--hand);
    font-size: 1rem;
    color: var(--ink);
    padding: 0.2rem 0.1rem;
  }

  .sketch-search-input:focus {
    outline: none;
    border-bottom-color: var(--brand);
  }

  .sketch-search-input::placeholder {
    color: color-mix(in srgb, var(--ink-muted) 80%, transparent);
  }

  .sketch-options {
    list-style: none;
    margin: 0;
    padding: 0;
    overflow: auto;
    min-height: 0;
    flex: 1 1 auto;
  }

  .sketch-empty {
    font-family: var(--hand);
    font-size: 0.95rem;
    color: var(--ink-muted);
    padding: 0.45rem 0.55rem;
  }

  .sketch-option {
    appearance: none;
    width: 100%;
    display: flex;
    align-items: baseline;
    gap: 0.35rem;
    border: none;
    background: transparent;
    color: var(--ink);
    font-family: var(--hand);
    font-size: 1.02rem;
    padding: 0.28rem 0.45rem;
    cursor: pointer;
    text-align: left;
  }

  .sketch-option .dot {
    color: var(--ink-muted);
    flex: none;
  }

  .sketch-option .mark {
    padding: 0.05rem 0.15rem;
    line-height: 1.25;
  }

  .sketch-option:hover .mark {
    background: color-mix(in srgb, var(--yellow) 28%, transparent);
  }

  .sketch-option.selected .dot {
    color: var(--ink);
  }

  .sketch-option.selected .mark {
    background: color-mix(in srgb, var(--yellow) 62%, transparent);
  }

  .sketch-option.empty {
    color: var(--ink-muted);
  }

  .sketch-option.empty .mark {
    color: color-mix(in srgb, var(--ink-muted) 85%, transparent);
  }

  .sketch-option.empty:hover .mark {
    background: color-mix(in srgb, var(--ink) 6%, transparent);
  }

  .sketch-option.empty.selected .mark {
    background: color-mix(in srgb, var(--ink) 8%, transparent);
  }

  .sketch-option.empty.selected .dot {
    color: var(--ink-muted);
  }

  .sketch-multi-foot {
    flex: 0 0 auto;
    display: flex;
    justify-content: flex-end;
    padding: 0.25rem 0.35rem 0.1rem;
    border-top: 1px dashed color-mix(in srgb, var(--ink) 14%, transparent);
    margin-top: 0.2rem;
  }

  .sketch-done {
    appearance: none;
    border: 1.5px solid color-mix(in srgb, var(--ink) 22%, transparent);
    background: color-mix(in srgb, var(--yellow) 45%, var(--mix-wash));
    color: var(--ink);
    font-family: var(--hand);
    font-size: 0.95rem;
    padding: 0.15rem 0.65rem;
    cursor: pointer;
    border-radius: 3px 8px 4px 7px / 7px 3px 8px 4px;
  }

  @media (max-width: 640px) {
    .sketch-select.searchable .sketch-menu {
      min-width: min(100%, 16rem);
      max-width: calc(100vw - 1.5rem);
    }

    .sketch-trigger {
      min-height: 2.5rem;
    }

    .sketch-done {
      min-height: 2.5rem;
      padding: 0.35rem 0.85rem;
    }
  }
</style>
