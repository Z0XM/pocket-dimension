<script lang="ts">
  type Option = {
    value: string;
    label: string;
  };

  type Props = {
    name: string;
    options: Option[];
    value?: string;
    disabled?: boolean;
    compact?: boolean;
    onChange?: (value: string) => void;
    "aria-label"?: string;
  };

  let { name, options, value = $bindable(""), disabled = false, compact = false, onChange, "aria-label": ariaLabel }: Props = $props();

  let open = $state(false);
  let root: HTMLDivElement | undefined = $state();

  const selectedLabel = $derived(options.find((option) => option.value === value)?.label ?? options[0]?.label ?? "");

  function toggleOpen() {
    if (disabled) return;
    open = !open;
  }

  function choose(next: string) {
    value = next;
    open = false;
    onChange?.(next);
  }

  $effect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node | null;
      if (root && target && !root.contains(target)) {
        open = false;
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") open = false;
    }

    const timeout = window.setTimeout(() => {
      window.addEventListener("pointerdown", handlePointerDown);
      window.addEventListener("keydown", handleKeyDown);
    }, 0);

    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  });
</script>

<div class="sketch-select" class:open class:disabled class:compact bind:this={root}>
  <input type="hidden" {name} {value} />
  <button type="button" class="sketch-trigger" aria-expanded={open} aria-haspopup="listbox" aria-label={ariaLabel} {disabled} onclick={toggleOpen}>
    <span class="sketch-value">{selectedLabel}</span>
    <span class="sketch-caret" aria-hidden="true">▾</span>
  </button>

  {#if open}
    <ul class="sketch-menu" role="listbox" aria-label={ariaLabel}>
      {#each options as option (option.value)}
        {@const selected = option.value === value}
        <li>
          <button type="button" role="option" class="sketch-option" class:selected aria-selected={selected} onclick={() => choose(option.value)}>
            <span class="dot" aria-hidden="true">•</span>
            <span class="mark">{option.label}</span>
          </button>
        </li>
      {/each}
    </ul>
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

  .sketch-trigger:hover:not(:disabled),
  .sketch-select.open .sketch-trigger {
    border-bottom-color: var(--brand);
  }

  .sketch-select.compact .sketch-trigger:hover:not(:disabled),
  .sketch-select.compact.open .sketch-trigger {
    background: color-mix(in srgb, var(--yellow) 78%, transparent);
    border-bottom-color: transparent;
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
    list-style: none;
    margin: 0.2rem 0 0;
    padding: 0.35rem 0.25rem;
    position: absolute;
    left: 0;
    right: 0;
    z-index: 30;
    background: #fffef8;
    border: 1.5px solid color-mix(in srgb, var(--ink) 28%, transparent);
    border-radius: 2px 6px 3px 2px;
    box-shadow:
      2px 2px 0 0 #f7f4ea,
      2px 2px 0 1.5px color-mix(in srgb, var(--ink) 16%, transparent);
    max-height: 14rem;
    overflow: auto;
  }

  .sketch-select.compact .sketch-menu {
    right: auto;
    min-width: max(100%, 7.5rem);
    z-index: 40;
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
</style>
