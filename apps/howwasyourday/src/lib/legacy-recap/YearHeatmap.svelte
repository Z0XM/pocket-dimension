<script lang="ts">
  import type { HeatCell } from "./types";
  import { formatShortDate } from "./types";

  type Props = {
    cells: HeatCell[];
  };

  let { cells }: Props = $props();

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const LOUPE_WEEKS = 3; // columns on each side of focus

  // week columns starting Monday
  const weeks = $derived.by(() => {
    const grid: (HeatCell | null)[][] = [];
    let col: (HeatCell | null)[] = Array(7).fill(null);
    for (const cell of cells) {
      const dow = new Date(cell.date + "T12:00:00").getDay(); // 0 Sun
      const idx = dow === 0 ? 6 : dow - 1;
      if (idx === 0 && col.some(Boolean)) {
        grid.push(col);
        col = Array(7).fill(null);
      }
      col[idx] = cell;
    }
    if (col.some(Boolean)) grid.push(col);
    return grid;
  });

  let gridEl = $state<HTMLDivElement | null>(null);
  let loupeOpen = $state(false);
  let loupeWeek = $state(0);
  let loupeX = $state(0);
  let loupeY = $state(0);

  const loupeSlice = $derived.by(() => {
    if (!weeks.length) return [] as (HeatCell | null)[][];
    const start = Math.max(0, loupeWeek - LOUPE_WEEKS);
    const end = Math.min(weeks.length - 1, loupeWeek + LOUPE_WEEKS);
    return weeks.slice(start, end + 1);
  });

  const loupeFocusOffset = $derived(
    Math.min(LOUPE_WEEKS, loupeWeek) // index of focus week within slice
  );

  const loupeFrom = $derived.by(() => {
    for (const week of loupeSlice) {
      for (const cell of week) {
        if (cell?.date) return cell.date;
      }
    }
    return null;
  });

  const loupeTo = $derived.by(() => {
    for (let w = loupeSlice.length - 1; w >= 0; w--) {
      const week = loupeSlice[w];
      for (let d = week.length - 1; d >= 0; d--) {
        if (week[d]?.date) return week[d]!.date;
      }
    }
    return null;
  });

  function onGridMove(e: MouseEvent) {
    const el = gridEl;
    if (!el || !weeks.length) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(0.999, x / rect.width));
    loupeWeek = Math.floor(ratio * weeks.length);
    loupeOpen = true;

    const cardW = 220;
    const pad = 12;
    loupeX = Math.max(pad, Math.min(window.innerWidth - cardW - pad, e.clientX - cardW / 2));
    loupeY = Math.max(pad, e.clientY - 200);
  }

  function onGridLeave() {
    loupeOpen = false;
  }
</script>

<div class="cal-scroll">
  <div class="cal" style={`--weeks: ${Math.max(weeks.length, 1)}`} aria-label="2025 year color calendar of logged days">
    <div class="months">
      {#each months as m}
        <span>{m}</span>
      {/each}
    </div>
    <div
      class="grid"
      bind:this={gridEl}
      role="img"
      aria-label="Hover to magnify a section of the calendar"
      onmousemove={onGridMove}
      onmouseleave={onGridLeave}
    >
      {#each weeks as week, wi}
        <div class="week">
          {#each week as cell}
            {#if cell}
              <span
                class:filled={cell.filled}
                class:focus={loupeOpen && wi === loupeWeek}
                title={cell.filled ? `${cell.date} · score ${cell.score ?? "—"} ${cell.emoji}` : cell.date}
                style={cell.filled && cell.color ? `background:${cell.color}` : undefined}
              ></span>
            {:else}
              <span class="empty" class:focus={loupeOpen && wi === loupeWeek}></span>
            {/if}
          {/each}
        </div>
      {/each}
    </div>
  </div>
</div>

{#if loupeOpen && loupeFrom && loupeTo && loupeSlice.length}
  <div class="cal-loupe" style={`left: ${loupeX}px; top: ${loupeY}px`} role="tooltip">
    <p class="loupe-range">
      <span>{formatShortDate(loupeFrom)}</span>
      <span class="loupe-range-sep" aria-hidden="true">→</span>
      <span>{formatShortDate(loupeTo)}</span>
    </p>
    <div class="loupe-zoom" style={`--zweeks: ${loupeSlice.length}; --focus-col: ${loupeFocusOffset}`}>
      {#each loupeSlice as week, wi}
        <div class="loupe-week" class:focus-week={wi === loupeFocusOffset}>
          {#each week as cell}
            {#if cell}
              <span class:filled={cell.filled} style={cell.filled && cell.color ? `background:${cell.color}` : undefined}></span>
            {:else}
              <span class="empty"></span>
            {/if}
          {/each}
        </div>
      {/each}
    </div>
  </div>
{/if}

<style>
  .cal-scroll {
    width: 100%;
  }

  .cal {
    width: 100%;
  }

  .months {
    display: grid;
    grid-template-columns: repeat(12, 1fr);
    gap: 0.25rem;
    width: 100%;
    margin-bottom: 0.45rem;
    font-size: 0.78rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--ink-mute);
  }

  .grid {
    display: grid;
    width: 100%;
    grid-auto-flow: column;
    grid-template-rows: repeat(7, minmax(0, 1fr));
    grid-template-columns: repeat(var(--weeks), minmax(0, 1fr));
    aspect-ratio: var(--weeks) / 7;
    gap: clamp(2px, 0.28vw, 3.5px);
    cursor: crosshair;
  }

  .week {
    display: contents;
  }

  .grid span {
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
    aspect-ratio: 1;
    background: color-mix(in srgb, var(--ink) 8%, transparent);
    transition:
      outline-color 0.12s ease,
      filter 0.12s ease;
  }

  .grid span.filled {
    outline: 1px solid color-mix(in srgb, var(--ink) 18%, transparent);
  }

  .grid span.empty {
    background: transparent;
  }

  .grid span.focus {
    outline: 1.5px solid var(--accent, #214247);
    outline-offset: 0;
    filter: brightness(1.06);
    z-index: 1;
  }

  .cal-loupe {
    position: fixed;
    z-index: 40;
    width: 220px;
    padding: 0.7rem 0.85rem 0.85rem;
    pointer-events: none;
    border-radius: 0.65rem;
    border: 1px solid color-mix(in srgb, var(--ink) 12%, transparent);
    background: color-mix(in srgb, #f3f6f4 92%, white);
    box-shadow: 0 8px 24px color-mix(in srgb, var(--ink) 10%, transparent);
    color: var(--ink);
  }

  .loupe-range {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
    margin: 0 0 0.55rem;
    font-family: var(--display);
    font-size: 0.95rem;
    font-weight: 500;
    color: var(--ink);
  }

  .loupe-range-sep {
    color: var(--ink-mute);
    font-size: 0.85rem;
  }

  .loupe-zoom {
    display: grid;
    grid-template-columns: repeat(var(--zweeks), 18px);
    gap: 4px;
    justify-content: center;
  }

  .loupe-week {
    display: grid;
    grid-template-rows: repeat(7, 18px);
    gap: 3px;
  }

  .loupe-week.focus-week {
    outline: 1.5px solid var(--accent, #214247);
    outline-offset: 1px;
    border-radius: 2px;
  }

  .loupe-week span {
    width: 18px;
    height: 18px;
    background: color-mix(in srgb, var(--ink) 8%, transparent);
    border-radius: 2px;
  }

  .loupe-week span.filled {
    outline: 1px solid color-mix(in srgb, var(--ink) 14%, transparent);
  }

  .loupe-week span.empty {
    background: transparent;
  }

  @media (max-width: 720px) {
    .cal-scroll {
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      overscroll-behavior-x: contain;
      padding-bottom: 0.25rem;
    }

    .cal {
      /* Keep months + grid as one wide unit so they scroll together */
      width: max(100%, calc(var(--weeks, 53) * 14px));
      min-width: max(100%, calc(var(--weeks, 53) * 14px));
    }

    .months {
      width: 100%;
    }

    .grid {
      width: 100%;
      aspect-ratio: auto;
      max-height: none;
      grid-template-rows: repeat(7, 12px);
      grid-template-columns: repeat(var(--weeks), 12px);
      gap: 2px;
    }

    .grid span {
      width: 12px;
      height: 12px;
      aspect-ratio: auto;
    }
  }
</style>
