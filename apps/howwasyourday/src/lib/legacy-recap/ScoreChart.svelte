<script lang="ts">
  import type { DayEntry } from "./types";
  import { parseDate } from "./types";

  type Props = {
    days: DayEntry[];
  };

  let { days }: Props = $props();

  const width = 720;
  const height = 180;
  const padX = 28;
  const padY = 28;

  const points = $derived.by(() => {
    if (!days.length) return [];
    const times = days.map((d) => parseDate(d.date).getTime());
    const minT = Math.min(...times);
    const maxT = Math.max(...times);
    const span = Math.max(maxT - minT, 1);
    return days.map((day, i) => {
      const score = day.day_score ?? 0;
      const t = parseDate(day.date).getTime();
      const x = padX + ((t - minT) / span) * (width - padX * 2);
      const y = height - padY - (score / 11) * (height - padY * 2);
      return { x, y, score, date: day.date, i };
    });
  });

  const path = $derived(points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" "));

  const labels = $derived.by(() => {
    if (points.length < 2) return points;
    // first, last, and mid-ish unique months
    const pick = [points[0], points[points.length - 1]];
    const mid = points[Math.floor(points.length / 2)];
    if (mid && mid.date !== pick[0].date && mid.date !== pick[1].date) pick.splice(1, 0, mid);
    return pick;
  });
</script>

<svg class="chart" viewBox="0 0 {width} {height}" role="img" aria-label="Day scores over calendar time">
  <line class="grid" x1={padX} y1={height - padY} x2={width - padX} y2={height - padY} />
  <text class="axis" x={padX} y={padY - 8}>11</text>
  <text class="axis" x={padX} y={height - padY + 4}>0</text>
  {#if points.length}
    <path class="line" d={path} />
    {#each points as p}
      <circle class="dot" cx={p.x} cy={p.y} r="4.5" style={`--i: ${p.i}`} />
    {/each}
    {#each labels as p}
      <text class="label" x={p.x} y={height - 6}>{p.date.slice(5)}</text>
    {/each}
  {/if}
</svg>

<style>
  .chart {
    width: 100%;
    height: auto;
    display: block;
    overflow: visible;
  }

  .grid {
    stroke: color-mix(in srgb, var(--ink) 18%, transparent);
    stroke-width: 1;
  }

  .axis {
    fill: var(--ink-mute);
    font-size: 10px;
    font-family: var(--sans);
  }

  .line {
    fill: none;
    stroke: var(--accent);
    stroke-width: 2.25;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-dasharray: 1200;
    stroke-dashoffset: 1200;
    animation: draw 1.2s ease forwards 0.25s;
  }

  .dot {
    fill: var(--paper);
    stroke: var(--accent);
    stroke-width: 2;
    opacity: 0;
    animation: pop 0.35s ease forwards;
    animation-delay: calc(0.4s + var(--i) * 0.03s);
  }

  .label {
    fill: var(--ink-mute);
    font-size: 10px;
    font-family: var(--sans);
    text-anchor: middle;
  }

  @keyframes draw {
    to {
      stroke-dashoffset: 0;
    }
  }

  @keyframes pop {
    to {
      opacity: 1;
    }
  }
</style>
