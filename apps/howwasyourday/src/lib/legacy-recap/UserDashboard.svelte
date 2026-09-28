<script lang="ts">
  import type { UserRecap } from "./types";
  import type { AiAnalysisBody } from "./ai-analysis-types";
  import { buildYearHeatmap, countBy, formatMonthYear, formatShortDate, monthLabel, normalizePerson, wordTokens } from "./types";
  import DayTimeline from "./DayTimeline.svelte";
  import YearHeatmap from "./YearHeatmap.svelte";
  import EmojiMood from "./EmojiMood.svelte";
  import WordCloud from "./WordCloud.svelte";
  import PeopleWall from "./PeopleWall.svelte";
  import DrawingsCanvas from "./DrawingsCanvas.svelte";
  import AiSummary from "./AiSummary.svelte";

  type Props = {
    recap: UserRecap;
    aiAnalysis?: AiAnalysisBody | null;
  };

  let { recap, aiAnalysis = null }: Props = $props();

  const user = $derived(recap.user);
  const summary = $derived(recap.summary);
  const days = $derived(recap.days);

  const emojis = $derived(countBy(days.map((d) => d.day_emoji).filter(Boolean)));
  const words = $derived(wordTokens(days).slice(0, 48));
  const people = $derived(countBy(days.map((d) => normalizePerson(d.day_person)).filter(Boolean)));

  const drawings = $derived(days.filter((d) => d.drawing_src));

  const heat = $derived(buildYearHeatmap(days, 2025));

  const spanLabel = $derived(
    summary.first_date && summary.last_date ? `${formatMonthYear(summary.first_date)} – ${formatMonthYear(summary.last_date)}` : ""
  );

  const ledeParts = $derived.by(() => {
    const parts: string[] = [`${summary.days_filled} logged ${summary.days_filled === 1 ? "day" : "days"}`];
    if (spanLabel) parts.push(spanLabel);
    parts.push(`avg ${summary.avg_score ?? "—"}`);
    if (summary.drawings_count) {
      parts.push(`${summary.drawings_count} ${summary.drawings_count === 1 ? "drawing" : "drawings"}`);
    }
    return parts;
  });

  function scoreHeight(score: number | null): string {
    const s = score ?? 0;
    const t = Math.max(0.12, Math.min(1, s / 11));
    return `${(t * 100).toFixed(1)}%`;
  }

  const LOUPE_RADIUS = 18; // bars on each side of focus (~37 total)
  let ribbonEl = $state<HTMLDivElement | null>(null);
  let loupeOpen = $state(false);
  let loupeIndex = $state(0);
  let loupeX = $state(0);
  let loupeY = $state(0);

  const loupeWindow = $derived.by(() => {
    if (!days.length) return [] as { day: (typeof days)[number]; i: number; focus: boolean }[];
    const start = Math.max(0, loupeIndex - LOUPE_RADIUS);
    const end = Math.min(days.length - 1, loupeIndex + LOUPE_RADIUS);
    const out: { day: (typeof days)[number]; i: number; focus: boolean }[] = [];
    for (let i = start; i <= end; i++) {
      out.push({ day: days[i], i, focus: i === loupeIndex });
    }
    return out;
  });

  const loupeFocus = $derived(days[loupeIndex] ?? null);
  const loupeFrom = $derived(loupeWindow[0]?.day.date ?? null);
  const loupeTo = $derived(loupeWindow[loupeWindow.length - 1]?.day.date ?? null);

  function onRibbonMove(e: MouseEvent) {
    const el = ribbonEl;
    if (!el || !days.length) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(0.999, x / rect.width));
    loupeIndex = Math.floor(ratio * days.length);
    loupeOpen = true;

    // Keep card near pointer, clamped inside viewport padding
    const cardW = 340;
    const pad = 12;
    loupeX = Math.max(pad, Math.min(window.innerWidth - cardW - pad, e.clientX - cardW / 2));
    loupeY = Math.max(pad, e.clientY - 148);
  }

  function onRibbonLeave() {
    loupeOpen = false;
  }
</script>

<main style={`--accent: ${user.accent_color || "#214247"}`}>
  <a class="back" href="/recap/2025">All dashboards</a>

  <section class="hero">
    <div class="hero-copy">
      <p class="eyebrow">
        Year recap · 2025{#if summary.rank}<span> · rank #{summary.rank}</span>{/if}
      </p>
      <h1>{user.display_name}</h1>
      <p class="lede">
        {#each ledeParts as part, i}
          {#if i > 0}<span class="sep" aria-hidden="true">·</span>{/if}
          <span>{part}</span>
        {/each}
      </p>
    </div>
    <div
      class="ribbon"
      bind:this={ribbonEl}
      style={`--cols: ${Math.max(days.length, 1)}`}
      role="img"
      aria-label="Day score color ribbon. Hover to magnify a section."
      onmousemove={onRibbonMove}
      onmouseleave={onRibbonLeave}
    >
      {#each days as day, i}
        <span class:focus={loupeOpen && i === loupeIndex} style={`--c: ${day.day_color || "#a1a1a1"}; --i: ${i}; --h: ${scoreHeight(day.day_score)}`}
        ></span>
      {/each}
    </div>
  </section>

  {#if loupeOpen && loupeFocus && loupeFrom && loupeTo}
    <div class="ribbon-loupe" style={`left: ${loupeX}px; top: ${loupeY}px`} role="tooltip">
      <p class="loupe-range">
        <span>{formatShortDate(loupeFrom)}</span>
        <span class="loupe-range-sep" aria-hidden="true">→</span>
        <span>{formatShortDate(loupeTo)}</span>
      </p>
      <div class="loupe-zoom" style={`--zcols: ${loupeWindow.length}`}>
        {#each loupeWindow as item}
          <span
            class:focus={item.focus}
            style={`--c: ${item.day.day_color || "#a1a1a1"}; --h: ${scoreHeight(item.day.day_score)}`}
            title={item.day.date}
          ></span>
        {/each}
      </div>
    </div>
  {/if}

  <section class="stats" aria-label="Summary">
    <div>
      <span class="stat-value">{summary.days_filled}</span>
      <span class="stat-label">Days filled</span>
    </div>
    <div>
      <span class="stat-value">{summary.avg_score ?? "—"}</span>
      <span class="stat-label">Avg score</span>
    </div>
    <div>
      <span class="stat-value">{summary.min_score ?? "—"}–{summary.max_score ?? "—"}</span>
      <span class="stat-label">Score range</span>
    </div>
    <div>
      <span class="stat-value">{people.length || "—"}</span>
      <span class="stat-label">People named</span>
    </div>
  </section>

  {#if aiAnalysis}
    <AiSummary analysis={aiAnalysis} />
  {/if}

  <section class="panel calendar-panel">
    <YearHeatmap cells={heat} />
  </section>

  {#if emojis.length}
    <EmojiMood items={emojis} />
  {/if}

  {#if words.length}
    <WordCloud items={words} />
  {/if}

  {#if people.length}
    <PeopleWall items={people} />
  {/if}

  {#if drawings.length}
    <DrawingsCanvas {drawings} exportName={summary.slug || user.display_name} />
  {/if}

  <section class="panel">
    <div class="panel-head">
      <h2>Timeline</h2>
    </div>
    <DayTimeline {days} />
  </section>

  {#if recap.months?.length}
    <section class="panel">
      <div class="panel-head">
        <h2>Month notes</h2>
        <p>{recap.months.length} month form{recap.months.length === 1 ? "" : "s"}.</p>
      </div>
      <ul class="months">
        {#each recap.months as month}
          <li>
            <strong>{monthLabel(month.month_int)}</strong>
            {#if month.month_good}<p><span>Good</span> {month.month_good}</p>{/if}
            {#if month.month_bad}<p><span>Hard</span> {month.month_bad}</p>{/if}
            {#if month.month_next_hopes}<p><span>Next</span> {month.month_next_hopes}</p>{/if}
          </li>
        {/each}
      </ul>
    </section>
  {/if}
</main>

<style>
  main {
    --paper: #f3f6f4;
    --ink: #142326;
    --ink-soft: #3d5256;
    --ink-mute: #6a7f83;
    min-height: 100vh;
    color: var(--ink);
    background:
      radial-gradient(120% 80% at 10% -10%, color-mix(in srgb, var(--accent) 28%, #f3f6f4), transparent 55%),
      radial-gradient(90% 60% at 100% 0%, color-mix(in srgb, var(--accent) 18%, #e8f0ec), transparent 50%),
      linear-gradient(180deg, #eef4f1 0%, var(--paper) 40%, #e7efeb 100%);
    padding: clamp(1.5rem, 4vw, 3.5rem);
  }

  .back {
    display: inline-block;
    margin-bottom: 1.5rem;
    font-size: 0.85rem;
    color: var(--ink-mute);
    text-decoration: none;
    letter-spacing: 0.04em;
  }

  .back:hover {
    color: var(--accent);
  }

  .hero {
    display: grid;
    gap: 2rem;
    align-items: end;
    min-height: min(58vh, 28rem);
    padding-bottom: 1rem;
  }

  .eyebrow {
    margin: 0 0 0.75rem;
    font-family: var(--sans);
    font-size: 0.8rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--ink-mute);
  }

  h1 {
    margin: 0;
    font-family: var(--display);
    font-size: clamp(3rem, 11vw, 6.5rem);
    font-weight: 500;
    line-height: 0.92;
    letter-spacing: -0.03em;
    color: var(--accent);
  }

  .lede {
    margin: 1.25rem 0 0;
    max-width: 36rem;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.25rem 0.5rem;
    font-size: 1.05rem;
    line-height: 1.45;
    color: var(--ink-soft);
  }

  .lede .sep {
    color: var(--ink-mute);
  }

  .ribbon {
    display: grid;
    grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
    gap: 2px;
    height: clamp(4rem, 12vw, 7rem);
    width: 100%;
    align-items: end;
    cursor: crosshair;
    position: relative;
  }

  .ribbon span {
    display: block;
    width: 100%;
    height: var(--h);
    background: var(--c);
    border: 1px solid color-mix(in srgb, var(--ink) 10%, transparent);
    transform-origin: bottom;
    transform: scaleY(0.15);
    animation: grow 0.7s cubic-bezier(0.22, 1, 0.36, 1) forwards;
    animation-delay: calc(0.06s + var(--i) * 0.012s);
    transition:
      filter 0.12s ease,
      outline-color 0.12s ease;
  }

  .ribbon span.focus {
    outline: 2px solid var(--ink);
    outline-offset: 1px;
    filter: brightness(1.08);
    z-index: 1;
  }

  .ribbon-loupe {
    position: fixed;
    z-index: 40;
    width: 340px;
    padding: 0.75rem 0.9rem 0.9rem;
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
    font-size: 0.98rem;
    font-weight: 500;
    color: var(--ink);
  }

  .loupe-range-sep {
    color: var(--ink-mute);
    font-size: 0.85rem;
  }

  .loupe-zoom {
    display: grid;
    grid-template-columns: repeat(var(--zcols), minmax(0, 1fr));
    gap: 1px;
    height: 4.25rem;
    align-items: end;
  }

  .loupe-zoom span {
    display: block;
    width: 100%;
    height: var(--h);
    background: var(--c);
    opacity: 0.78;
  }

  .loupe-zoom span.focus {
    opacity: 1;
    outline: 1.5px solid var(--accent);
    outline-offset: 0;
  }

  .stats {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 1rem;
    margin: 2.5rem 0 3rem;
    padding: 1.25rem 0;
    border-top: 1px solid color-mix(in srgb, var(--ink) 12%, transparent);
    border-bottom: 1px solid color-mix(in srgb, var(--ink) 12%, transparent);
  }

  .stats > div {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .stat-value {
    font-family: var(--display);
    font-size: clamp(1.5rem, 3.5vw, 2.1rem);
    color: var(--ink);
    line-height: 1;
  }

  .stat-label {
    font-size: 0.78rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--ink-mute);
  }

  .panel {
    max-width: 48rem;
    margin-bottom: 3.25rem;
  }

  .calendar-panel {
    max-width: min(56rem, 100%);
  }

  .panel-head {
    margin-bottom: 1.1rem;
  }

  .panel-head h2 {
    margin: 0;
    font-family: var(--display);
    font-size: 1.7rem;
    font-weight: 500;
    color: var(--ink);
  }

  .panel-head p {
    margin: 0.35rem 0 0;
    color: var(--ink-mute);
    font-size: 0.95rem;
  }

  .months {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .months li strong {
    display: block;
    margin-bottom: 0.4rem;
    font-family: var(--display);
    font-size: 1.15rem;
  }

  .months p {
    margin: 0.25rem 0;
    color: var(--ink-soft);
    line-height: 1.5;
  }

  .months span {
    display: inline-block;
    min-width: 3rem;
    margin-right: 0.4rem;
    font-size: 0.75rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--ink-mute);
  }

  @keyframes grow {
    to {
      transform: scaleY(1);
    }
  }

  @media (max-width: 720px) {
    .stats {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .hero {
      min-height: auto;
    }
  }
</style>
