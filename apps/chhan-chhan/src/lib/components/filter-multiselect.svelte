<script lang="ts">
  import { Check } from "@lucide/svelte";

  type Option = {
    id: string;
    label: string;
  };

  type Props = {
    label: string;
    options: Option[];
    selected: string[];
    onchange: (selected: string[]) => void;
  };

  const { label, options, selected, onchange }: Props = $props();

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
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - 272));
    panelStyle = `top:${rect.bottom + 4}px;left:${left}px;`;
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

<div class="filter-multi" class:open bind:this={root}>
  <button type="button" class="filter-multi-btn" class:active={selected.length > 0} aria-expanded={open} aria-haspopup="listbox" onclick={toggleOpen}>
    {buttonLabel}
  </button>

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
  }

  .filter-multi-btn {
    display: block;
    min-width: 7rem;
    width: 100%;
    height: 1.625rem;
    box-sizing: border-box;
    padding: 0.35rem 0.65rem;
    background: var(--surface2);
    border: none;
    color: var(--muted);
    font-family: inherit;
    font-size: 0.68rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    cursor: pointer;
    text-align: left;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .filter-multi-btn.active,
  .filter-multi.open .filter-multi-btn {
    color: var(--background);
    background: var(--hi-purple);
  }

  .filter-multi-btn:hover:not(.active) {
    color: var(--hi-purple);
  }

  .filter-multi-panel {
    position: fixed;
    z-index: 100;
    width: min(16rem, calc(100vw - 1rem));
    max-height: min(18rem, calc(100vh - 8rem));
    overflow: auto;
    background: var(--surface);
    border: 2px solid var(--chrome-line);
    box-shadow: 6px 6px 0 rgba(234, 242, 240, 0.12);
    padding: 0.65rem;
  }

  .filter-multi-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    margin-bottom: 0.45rem;
    font-size: 0.62rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--muted);
  }

  .filter-multi-clear {
    background: none;
    border: none;
    color: var(--hi-purple);
    font-family: inherit;
    font-size: 0.62rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    cursor: pointer;
    padding: 0;
  }

  .filter-multi-panel ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .filter-option {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    width: 100%;
    padding: 0.35rem 0.25rem;
    border: none;
    background: transparent;
    color: var(--main-text);
    font-family: inherit;
    font-size: 0.72rem;
    letter-spacing: 0.04em;
    text-align: left;
    cursor: pointer;
  }

  .filter-option:hover,
  .filter-option.selected {
    background: color-mix(in srgb, var(--hi-purple) 10%, transparent);
  }

  .filter-mark {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 0.95rem;
    height: 0.95rem;
    border: 2px solid var(--chrome-line);
    background: var(--surface2);
    box-shadow: 1px 1px 0 rgba(234, 242, 240, 0.08);
    flex-shrink: 0;
    color: var(--background);
  }

  .filter-option.selected .filter-mark {
    background: var(--hi-purple);
    border-color: var(--hi-purple);
  }

  .filter-option:hover .filter-mark {
    border-color: color-mix(in srgb, var(--hi-purple) 55%, var(--chrome-line));
  }

  .filter-label {
    min-width: 0;
    line-height: 1.35;
  }
</style>
