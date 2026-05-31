<script lang="ts">
  import { LayoutGrid } from "@lucide/svelte";
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
    <LayoutGrid size={16} strokeWidth={1.5} aria-hidden="true" />
    Charts
  </button>

  {#if open}
    <div class="widget-picker-panel" role="dialog" aria-label="Configure dashboard charts">
      <div class="widget-picker-head">
        <h3>Dashboard charts</h3>
        <button type="button" class="widget-reset" onclick={resetDefaults}>Reset</button>
      </div>

      {#each categories as category (category)}
        <section class="widget-group">
          <h4>{categoryLabels[category]}</h4>
          <ul>
            {#each DASHBOARD_WIDGET_CATALOG.filter((widget) => widget.category === category) as widget (widget.id)}
              <li>
                <label>
                  <input type="checkbox" checked={isEnabled(widget.id)} onchange={() => toggleWidget(widget.id)} />
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
    gap: 0.35rem;
    background: var(--surface2);
    border: 2px solid var(--chrome-line);
    color: var(--main-text);
    padding: 0.35rem 0.65rem;
    font-family: inherit;
    font-size: 0.68rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    cursor: pointer;
  }

  .widget-picker-btn:hover,
  .widget-picker.open .widget-picker-btn {
    border-color: var(--hi-purple);
    color: var(--hi-purple);
  }

  .widget-picker-panel {
    position: absolute;
    top: calc(100% + 0.35rem);
    right: 0;
    z-index: 30;
    width: min(22rem, calc(100vw - 2rem));
    max-height: min(28rem, calc(100vh - 8rem));
    overflow: auto;
    background: var(--surface);
    border: 2px solid var(--chrome-line);
    box-shadow: 6px 6px 0 rgba(234, 242, 240, 0.12);
    padding: 0.85rem;
  }

  .widget-picker-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    margin-bottom: 0.65rem;
  }

  .widget-picker-head h3 {
    margin: 0;
    font-family: "Archivo Black", sans-serif;
    font-size: 0.72rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--hi-cyan);
  }

  .widget-reset {
    background: none;
    border: none;
    color: var(--hi-purple);
    font-family: inherit;
    font-size: 0.66rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    cursor: pointer;
    padding: 0;
  }

  .widget-group + .widget-group {
    margin-top: 0.75rem;
    padding-top: 0.75rem;
    border-top: 1px solid var(--chrome-line);
  }

  .widget-group h4 {
    margin: 0 0 0.45rem;
    font-size: 0.62rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--muted);
  }

  .widget-group ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
  }

  .widget-group label {
    display: flex;
    align-items: flex-start;
    gap: 0.45rem;
    cursor: pointer;
  }

  .widget-group input {
    margin-top: 0.15rem;
    accent-color: var(--hi-purple);
  }

  .widget-copy {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    min-width: 0;
  }

  .widget-copy strong {
    font-size: 0.72rem;
    letter-spacing: 0.04em;
  }

  .widget-copy span {
    font-size: 0.66rem;
    line-height: 1.35;
  }
</style>
