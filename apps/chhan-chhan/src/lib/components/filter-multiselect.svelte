<script lang="ts">
  import Check from "@lucide/svelte/icons/check";
  import ListFilter from "@lucide/svelte/icons/list-filter";

  type Option = {
    id: string;
    label: string;
  };

  type Props = {
    label: string;
    options: Option[];
    selected: string[];
    onchange: (selected: string[]) => void;
    variant?: "default" | "icon";
  };

  const { label, options = [], selected = [], onchange, variant = "default" }: Props = $props();

  let open = $state(false);
  let root: HTMLDivElement | undefined = $state();
  let panelStyle = $state("");

  const buttonLabel = $derived.by(() => {
    if (selected.length === 0) return label;
    if (selected.length === 1) {
      return options.find((option) => option.id === selected[0])?.label ?? label;
    }
    return `${label} (${selected.length})`;
  });

  function syncPanelPosition() {
    if (!root) return;
    const rect = root.getBoundingClientRect();
    const width = Math.max(rect.width, 12 * 16);
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    panelStyle = `top:${rect.bottom + 4}px;left:${left}px;width:${width}px;`;
  }

  function toggleOpen() {
    open = !open;
    if (open) syncPanelPosition();
  }

  function toggleOption(id: string) {
    onchange(selected.includes(id) ? selected.filter((value) => value !== id) : [...selected, id]);
  }

  function clearSelection() {
    onchange([]);
  }

  $effect(() => {
    if (!open) return;

    syncPanelPosition();

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node | null;
      if (root && target && !root.contains(target)) {
        open = false;
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") open = false;
    }

    function handleLayoutChange() {
      syncPanelPosition();
    }

    const attachListeners = () => {
      window.addEventListener("pointerdown", handlePointerDown);
      window.addEventListener("keydown", handleKeyDown);
      window.addEventListener("resize", handleLayoutChange);
      window.addEventListener("scroll", handleLayoutChange, true);
    };

    const timeout = window.setTimeout(attachListeners, 0);

    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleLayoutChange);
      window.removeEventListener("scroll", handleLayoutChange, true);
    };
  });
</script>

<div class="filter-multi" class:open class:icon={variant === "icon"} bind:this={root}>
  {#if variant === "icon"}
    <div class="filter-icon-row">
      <span class="filter-heading">{label}</span>
      <button
        type="button"
        class="filter-icon-btn"
        class:active={selected.length > 0}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label="Filter {label.toLowerCase()}"
        title="Filter {label.toLowerCase()}"
        onclick={toggleOpen}
      >
        <ListFilter size={14} strokeWidth={1.75} aria-hidden="true" />
        {#if selected.length > 0}
          <span class="filter-count">{selected.length}</span>
        {/if}
      </button>
    </div>
  {:else}
    <button
      type="button"
      class="filter-multi-btn"
      class:active={selected.length > 0}
      aria-expanded={open}
      aria-haspopup="listbox"
      onclick={toggleOpen}
    >
      <span class="filter-value">{buttonLabel}</span>
      <span class="filter-caret" aria-hidden="true">▾</span>
    </button>
  {/if}

  {#if open}
    <div class="filter-multi-panel" role="listbox" aria-label="{label} filter" aria-multiselectable="true" style={panelStyle}>
      <div class="filter-multi-head">
        <span>{label}</span>
        {#if selected.length}
          <button type="button" class="filter-multi-clear" onclick={clearSelection}>Clear</button>
        {/if}
      </div>
      <ul>
        {#each options as option (option.id)}
          {@const isSelected = selected.includes(option.id)}
          <li>
            <button
              type="button"
              role="option"
              class="filter-option"
              class:selected={isSelected}
              aria-selected={isSelected}
              onclick={() => toggleOption(option.id)}
            >
              <span class="filter-mark" aria-hidden="true">
                {#if isSelected}
                  <Check size={11} strokeWidth={2.5} />
                {/if}
              </span>
              <span class="filter-label">{option.label}</span>
            </button>
          </li>
        {/each}
      </ul>
    </div>
  {/if}
</div>

<style>
  .filter-multi {
    position: relative;
    min-width: 7.5rem;
  }

  .filter-multi.icon {
    min-width: 0;
  }

  .filter-icon-row {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }

  .filter-heading {
    font-family: var(--hand);
    font-size: 1rem;
    color: var(--ink-muted);
    letter-spacing: 0.01em;
  }

  .filter-icon-btn {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.55rem;
    height: 1.55rem;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--ink-muted);
    cursor: pointer;
    border-radius: 3px 8px 4px 7px / 7px 3px 8px 4px;
  }

  .filter-icon-btn:hover,
  .filter-multi.open .filter-icon-btn,
  .filter-icon-btn.active {
    color: var(--ink);
    background: color-mix(in srgb, var(--yellow) 55%, transparent);
  }

  .filter-count {
    position: absolute;
    top: -0.2rem;
    right: -0.25rem;
    min-width: 0.95rem;
    height: 0.95rem;
    padding: 0 0.18rem;
    border-radius: 999px;
    background: color-mix(in srgb, var(--yellow) 78%, transparent);
    border: 1px solid color-mix(in srgb, var(--ink) 22%, transparent);
    color: var(--ink);
    font-family: var(--hand);
    font-size: 0.62rem;
    line-height: 0.95rem;
    text-align: center;
  }

  .filter-multi-btn {
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
    letter-spacing: 0.01em;
    text-transform: none;
    padding: 0.05rem 0.1rem 0.28rem;
    cursor: pointer;
    text-align: left;
  }

  .filter-multi-btn:hover,
  .filter-multi.open .filter-multi-btn,
  .filter-multi-btn.active {
    border-bottom-color: var(--brand);
    color: var(--ink);
    background: transparent;
  }

  .filter-value {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .filter-caret {
    flex: none;
    color: var(--ink-muted);
    font-size: 0.85rem;
    line-height: 1;
  }

  .filter-multi-panel {
    position: fixed;
    z-index: 100;
    max-height: min(18rem, calc(100vh - 8rem));
    overflow: auto;
    background: var(--surface-raised);
    border: 1.5px solid color-mix(in srgb, var(--ink) 28%, transparent);
    border-radius: 2px 6px 3px 2px;
    box-shadow:
      2px 2px 0 0 var(--shadow-paper),
      2px 2px 0 1.5px color-mix(in srgb, var(--ink) 16%, transparent);
    padding: 0.35rem 0.25rem 0.45rem;
  }

  .filter-multi-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    margin: 0.15rem 0.45rem 0.4rem;
    font-family: var(--hand);
    font-size: 0.95rem;
    letter-spacing: 0.01em;
    text-transform: none;
    color: var(--ink-muted);
  }

  .filter-multi-clear {
    background: none;
    border: none;
    color: var(--brand);
    font-family: var(--hand);
    font-size: 0.9rem;
    letter-spacing: 0.01em;
    text-transform: none;
    cursor: pointer;
    padding: 0;
  }

  .filter-multi-panel ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
  }

  .filter-option {
    appearance: none;
    display: flex;
    align-items: baseline;
    gap: 0.4rem;
    width: 100%;
    padding: 0.28rem 0.45rem;
    border: none;
    background: transparent;
    color: var(--ink);
    font-family: var(--hand);
    font-size: 1.02rem;
    letter-spacing: 0.01em;
    text-align: left;
    cursor: pointer;
  }

  .filter-option:hover {
    background: color-mix(in srgb, var(--yellow) 45%, transparent);
  }

  .filter-option.selected .filter-label {
    background: color-mix(in srgb, var(--yellow) 72%, transparent);
    border-radius: 2px 7px 3px 6px / 6px 2px 7px 2px;
    padding: 0.05rem 0.15rem;
  }

  .filter-mark {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 0.95rem;
    height: 0.95rem;
    border: 1.5px solid color-mix(in srgb, var(--ink) 28%, transparent);
    background: transparent;
    flex-shrink: 0;
    color: var(--ink);
    border-radius: 2px;
    transform: translateY(0.1rem);
  }

  .filter-option.selected .filter-mark {
    background: color-mix(in srgb, var(--yellow) 72%, transparent);
    border-color: color-mix(in srgb, var(--ink) 40%, transparent);
  }

  .filter-label {
    min-width: 0;
    line-height: 1.25;
  }

  @media (max-width: 640px) {
    .filter-icon-btn {
      width: 2.5rem;
      height: 2.5rem;
    }

    .filter-multi-btn {
      min-height: 2.5rem;
      padding: 0.35rem 0.1rem 0.4rem;
      align-items: center;
    }

    .filter-option {
      min-height: 2.5rem;
      align-items: center;
      padding: 0.4rem 0.45rem;
    }
  }
</style>
