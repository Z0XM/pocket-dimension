<script lang="ts">
  import type { DayEntry } from "./types";
  import { formatShortDate } from "./types";

  type Props = {
    days: DayEntry[];
  };

  let { days }: Props = $props();

  const BATCH = 24;
  let visibleCount = $state(Math.min(BATCH, days.length));
  let sentinelEl = $state<HTMLLIElement | null>(null);
  let rootEl = $state<HTMLDivElement | null>(null);
  let showTopBtn = $state(false);

  const shown = $derived(days.slice(0, visibleCount));
  const hasMore = $derived(visibleCount < days.length);

  $effect(() => {
    const n = days.length;
    visibleCount = Math.min(BATCH, n);
  });

  function loadMore() {
    if (visibleCount >= days.length) return;
    visibleCount = Math.min(days.length, visibleCount + BATCH);
  }

  $effect(() => {
    const el = sentinelEl;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) loadMore();
      },
      { root: null, rootMargin: "900px 0px", threshold: 0 }
    );
    io.observe(el);
    return () => io.disconnect();
  });

  $effect(() => {
    const root = rootEl;
    if (!root) return;

    const update = () => {
      const rect = root.getBoundingClientRect();
      const timelineTop = rect.top + window.scrollY;
      const timelineBottom = timelineTop + root.offsetHeight;
      const y = window.scrollY;
      const vh = window.innerHeight;
      // Show once the user has scrolled into the timeline and past its start a bit
      const inTimeline = y + vh > timelineTop + 120 && y < timelineBottom - 40;
      const scrolledDown = y > timelineTop + 280;
      showTopBtn = inTimeline && scrolledDown;
    };

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        update();
        ticking = false;
      });
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", update);
    };
  });

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
</script>

<div class="timeline-wrap" bind:this={rootEl}>
  <ol class="timeline">
    {#each shown as day, i (day.day_int ?? day.date ?? i)}
      <li class="entry" style={`--day-color: ${day.day_color || "#a1a1a1"}`}>
        <div class="rail" aria-hidden="true">
          <span class="swatch"></span>
        </div>
        <article>
          <header>
            <span class="emoji" aria-hidden="true">{day.day_emoji || "·"}</span>
            <div class="meta">
              <time datetime={day.date}>{formatShortDate(day.date)}</time>
              <strong class="word">{day.day_word?.trim() || "Untitled day"}</strong>
            </div>
            <span class="score">{day.day_score ?? "—"}</span>
          </header>
          {#if day.day_note?.trim()}
            <p class="note">{day.day_note.trim()}</p>
          {/if}
          {#if day.day_public_note?.trim()}
            <p class="public-note">
              <span class="public-label">Public</span>
              {day.day_public_note.trim()}
            </p>
          {/if}
          {#if day.drawing_src}
            <figure class="drawing">
              <img src={day.drawing_src} alt={`Drawing for ${day.date}`} loading="lazy" decoding="async" />
            </figure>
          {/if}
          {#if day.day_person?.trim()}
            <footer>
              <span>With {day.day_person.trim()}</span>
            </footer>
          {/if}
        </article>
      </li>
    {/each}

    {#if hasMore}
      <li class="sentinel" bind:this={sentinelEl} aria-hidden="true">
        <span class="loading">Loading more days…</span>
      </li>
    {/if}
  </ol>

  {#if showTopBtn}
    <button type="button" class="to-top" onclick={scrollToTop} aria-label="Scroll to top"> Top </button>
  {/if}
</div>

<style>
  .timeline-wrap {
    position: relative;
  }

  .timeline {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .to-top {
    position: fixed;
    right: max(1rem, calc((100vw - 48rem) / 2 - 0.25rem));
    bottom: 1.25rem;
    z-index: 30;
    padding: 0.65rem 0.95rem;
    border-radius: 999px;
    border: 1px solid color-mix(in srgb, var(--ink) 14%, transparent);
    background: color-mix(in srgb, #f3f6f4 92%, white);
    color: var(--ink-soft);
    font-family: var(--sans);
    font-size: 0.85rem;
    letter-spacing: 0.02em;
    cursor: pointer;
    box-shadow: 0 6px 18px color-mix(in srgb, var(--ink) 12%, transparent);
  }

  .to-top:hover {
    color: var(--ink);
    border-color: color-mix(in srgb, var(--accent) 40%, transparent);
  }

  .to-top:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .entry {
    display: grid;
    grid-template-columns: 1.25rem 1fr;
    gap: 1rem;
  }

  .rail {
    position: relative;
    display: flex;
    justify-content: center;
    padding-top: 0.55rem;
  }

  .rail::before {
    content: "";
    position: absolute;
    top: 1.1rem;
    bottom: -1.35rem;
    width: 1px;
    background: color-mix(in srgb, var(--ink) 14%, transparent);
  }

  .entry:last-of-type .rail::before,
  .timeline:has(.sentinel) .entry:nth-last-child(2) .rail::before {
    display: none;
  }

  .swatch {
    width: 0.85rem;
    height: 0.85rem;
    border-radius: 50%;
    background: var(--day-color);
    border: 1px solid color-mix(in srgb, var(--ink) 20%, transparent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--day-color) 28%, transparent);
  }

  article {
    min-width: 0;
  }

  header {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 0.75rem;
    align-items: start;
  }

  .emoji {
    font-size: 1.5rem;
    line-height: 1;
  }

  .meta {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    min-width: 0;
  }

  time {
    font-family: var(--sans);
    font-size: 0.75rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--ink-soft);
  }

  .word {
    font-family: var(--display);
    font-size: 1.2rem;
    font-weight: 500;
    color: var(--ink);
    line-height: 1.25;
  }

  .score {
    font-family: var(--sans);
    font-variant-numeric: tabular-nums;
    font-size: 0.95rem;
    color: var(--accent);
    padding-top: 0.15rem;
  }

  .note {
    margin: 0.55rem 0 0;
    color: var(--ink-soft);
    font-size: 0.98rem;
    line-height: 1.55;
    max-width: 42rem;
  }

  .public-note {
    margin: 0.55rem 0 0;
    max-width: 42rem;
    padding: 0.55rem 0.7rem;
    border-left: 2px solid color-mix(in srgb, var(--accent) 45%, transparent);
    background: color-mix(in srgb, var(--accent) 6%, white);
    color: var(--ink-soft);
    font-size: 0.95rem;
    font-style: italic;
    line-height: 1.5;
  }

  .public-label {
    display: inline-block;
    margin-right: 0.45rem;
    font-family: var(--sans);
    font-size: 0.68rem;
    font-style: normal;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-mute);
  }

  .drawing {
    margin: 0.75rem 0 0;
    max-width: 22rem;
    background: #fff;
    border: 1px solid color-mix(in srgb, var(--ink) 12%, transparent);
    padding: 0.35rem;
  }

  .drawing img {
    display: block;
    width: 100%;
    height: auto;
  }

  footer {
    margin-top: 0.55rem;
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem 1.25rem;
    font-size: 0.85rem;
    color: var(--ink-mute);
  }

  .sentinel {
    list-style: none;
    padding: 0.5rem 0 1rem 2.25rem;
    min-height: 2rem;
  }

  .loading {
    font-family: var(--sans);
    font-size: 0.85rem;
    color: var(--ink-mute);
  }

  @media (max-width: 640px) {
    .word {
      font-size: 1.05rem;
    }
  }
</style>
