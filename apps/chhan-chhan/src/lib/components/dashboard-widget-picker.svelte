<script lang="ts">
  import LayoutGrid from "@lucide/svelte/icons/layout-grid";
  import {
    DASHBOARD_WIDGET_CATALOG,
    DEFAULT_DASHBOARD_WIDGETS,
    type DashboardWidgetCategory,
    type DashboardWidgetId,
  } from "$lib/finance/dashboard-widgets";

  type Props = {
    enabledWidgets: DashboardWidgetId[];
    onchange: (widgets: DashboardWidgetId[]) => void;
  };

  const { enabledWidgets, onchange }: Props = $props();

  let open = $state(false);
  let root: HTMLDivElement | undefined = $state();

  const categoryLabels: Record<DashboardWidgetCategory, string> = {
    summary: "Summary",
    spending: "Spending",
    trends: "Trends",
    goals: "Budgets & goals",
    billing: "Billing",
  };

  const categories = $derived([...new Set(DASHBOARD_WIDGET_CATALOG.map((widget) => widget.category))] as DashboardWidgetCategory[]);

  function isEnabled(id: DashboardWidgetId): boolean {
    return enabledWidgets.includes(id);
  }

  function toggleWidget(id: DashboardWidgetId) {
    const next = isEnabled(id) ? enabledWidgets.filter((widget) => widget !== id) : [...enabledWidgets, id];
    onchange(next.length ? next : [...DEFAULT_DASHBOARD_WIDGETS]);
  }

  function resetDefaults() {
    onchange([...DEFAULT_DASHBOARD_WIDGETS]);
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

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  });
</script>

<div class="widget-picker" class:open bind:this={root}>
  <button type="button" class="widget-picker-btn" aria-expanded={open} aria-haspopup="dialog" onclick={() => (open = !open)}>
    <LayoutGrid size={15} strokeWidth={1.6} aria-hidden="true" />
    Charts
  </button>

  {#if open}
    <div class="widget-picker-panel" role="dialog" aria-label="Configure dashboard charts">
      <div class="widget-picker-head">
        <h3>Charts</h3>
        <button type="button" class="widget-reset" onclick={resetDefaults}>Reset</button>
      </div>

      {#each categories as category (category)}
        <section class="widget-group">
          <h4>{categoryLabels[category]}</h4>
          <ul>
            {#each DASHBOARD_WIDGET_CATALOG.filter((widget) => widget.category === category) as widget (widget.id)}
              <li>
                <label class:on={isEnabled(widget.id)}>
                  <input type="checkbox" checked={isEnabled(widget.id)} onchange={() => toggleWidget(widget.id)} />
                  <span class="tick" aria-hidden="true">{isEnabled(widget.id) ? "✓" : "○"}</span>
                  <span class="widget-copy">
                    <strong>{widget.label}</strong>
                    <span class="dim">{widget.description}</span>
                  </span>
                </label>
              </li>
            {/each}
          </ul>
        </section>
      {/each}
    </div>
  {/if}
</div>

<style>
  .widget-picker {
    position: relative;
  }

  .widget-picker-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    background: transparent;
    border: none;
    color: var(--muted);
    padding: 0.15rem 0.45rem;
    font-family: var(--hand);
    font-size: 0.95rem;
    letter-spacing: 0.01em;
    text-transform: none;
    cursor: pointer;
    border-radius: 2px 8px 3px 7px / 7px 3px 8px 2px;
  }

  .widget-picker-btn:hover {
    color: var(--ink);
  }

  .widget-picker.open .widget-picker-btn {
    background: color-mix(in srgb, var(--yellow) 72%, transparent);
    color: var(--ink);
    transform: rotate(-0.5deg);
  }

  .widget-picker-panel {
    position: absolute;
    top: calc(100% + 0.35rem);
    right: 0;
    z-index: 40;
    width: min(22rem, calc(100vw - 2rem));
    max-height: min(28rem, calc(100vh - 8rem));
    overflow: auto;
    background: var(--surface-raised);
    border: 1.5px solid color-mix(in srgb, var(--ink) 28%, transparent);
    border-radius: 3px 12px 5px 10px / 10px 4px 12px 5px;
    box-shadow:
      2px 3px 0 0 color-mix(in srgb, var(--yellow) 45%, var(--shadow-paper)),
      2px 3px 0 1.5px color-mix(in srgb, var(--ink) 16%, transparent);
    padding: 0.75rem 0.7rem 0.85rem;
    font-family: var(--hand);
    color: var(--ink);
    transform: rotate(0.35deg);
  }

  .widget-picker-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.5rem;
    margin-bottom: 0.55rem;
    padding: 0 0.15rem 0.45rem;
    border-bottom: 1.5px solid color-mix(in srgb, var(--ink) 18%, transparent);
  }

  .widget-picker-head h3 {
    margin: 0;
    font-family: var(--hand);
    font-size: 1.05rem;
    font-weight: 400;
    letter-spacing: 0.01em;
    text-transform: none;
    color: var(--ink);
  }

  .widget-reset {
    background: none;
    border: none;
    color: var(--ink-muted);
    font-family: var(--hand);
    font-size: 0.9rem;
    letter-spacing: 0.01em;
    text-transform: none;
    cursor: pointer;
    padding: 0.05rem 0.2rem;
    border-radius: 2px 7px 3px 6px / 6px 2px 7px 2px;
  }

  .widget-reset:hover {
    color: var(--brand);
    background: color-mix(in srgb, var(--yellow) 45%, transparent);
  }

  .widget-group + .widget-group {
    margin-top: 0.7rem;
    padding-top: 0.65rem;
    border-top: 1.5px dashed color-mix(in srgb, var(--ink) 16%, transparent);
  }

  .widget-group h4 {
    margin: 0 0 0.35rem;
    padding: 0 0.15rem;
    font-family: var(--hand);
    font-size: 0.85rem;
    font-weight: 400;
    letter-spacing: 0.01em;
    text-transform: none;
    color: var(--ink-muted);
  }

  .widget-group ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .widget-group label {
    display: flex;
    align-items: flex-start;
    gap: 0.4rem;
    cursor: pointer;
    padding: 0.28rem 0.35rem;
    border-radius: 2px 8px 3px 7px / 7px 2px 8px 2px;
  }

  .widget-group label:hover {
    background: color-mix(in srgb, var(--yellow) 28%, transparent);
  }

  .widget-group label.on {
    background: color-mix(in srgb, var(--yellow) 42%, transparent);
  }

  .widget-group input {
    position: absolute;
    opacity: 0;
    width: 1px;
    height: 1px;
    pointer-events: none;
  }

  .tick {
    flex: none;
    width: 1rem;
    margin-top: 0.05rem;
    color: var(--ink-muted);
    font-size: 0.95rem;
    line-height: 1.2;
    text-align: center;
  }

  .widget-group label.on .tick {
    color: var(--ink);
  }

  .widget-copy {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    min-width: 0;
  }

  .widget-copy strong {
    font-size: 0.98rem;
    font-weight: 400;
    letter-spacing: 0.01em;
    color: var(--ink);
    line-height: 1.2;
  }

  .widget-copy .dim {
    font-size: 0.82rem;
    line-height: 1.35;
    color: var(--ink-muted);
  }
</style>
