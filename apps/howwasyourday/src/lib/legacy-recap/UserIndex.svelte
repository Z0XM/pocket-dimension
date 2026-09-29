<script lang="ts">
  import type { UserIndexEntry } from "./types";
  import { formatShortDate } from "./types";

  type Props = {
    users: UserIndexEntry[];
  };

  let { users }: Props = $props();

  const sorted = $derived([...users].sort((a, b) => a.rank - b.rank));

  function plural(n: number, one: string, many: string) {
    return `${n} ${n === 1 ? one : many}`;
  }

  function metaParts(u: UserIndexEntry): string[] {
    const parts = [plural(u.days_filled, "day", "days")];
    if (u.drawings_count) parts.push(plural(u.drawings_count, "drawing", "drawings"));
    if (u.months_filled) parts.push(plural(u.months_filled, "month", "months"));
    parts.push(`avg ${u.avg_score ?? "—"}`);
    if (u.first_date && u.last_date) {
      parts.push(`${formatShortDate(u.first_date)} – ${formatShortDate(u.last_date)}`);
    }
    return parts;
  }
</script>

<main>
  <header>
    <a class="home-link" href="/">
      <span class="home-link-kicker">Back to How Was Your Day</span>
      <strong>Go to the homepage to fill out your form</strong>
      <span class="home-link-copy">Use the normal homepage to log a new daily entry.</span>
    </a>
    <p class="eyebrow">Year recap · 2025</p>
    <h1>In-scope dashboards</h1>
    <p class="lede">
      Pick your name to open a private 2025 dashboard. Confirm your email, enter the one-time code, then optionally sign in to keep access without
      OTP.
    </p>
    {#if users.length === 0}
      <p class="lede">No dashboards yet. They will appear here after legacy recap data is imported.</p>
    {/if}
  </header>

  <section>
    <ol>
      {#each sorted as u}
        <li style={`--accent: ${u.accent_color || "#214247"}`}>
          <a href={`/recap/2025/${u.slug}`}>
            <span class="rank">#{u.rank}</span>
            <div class="body">
              <strong>{u.display_name}</strong>
              <span class="meta">
                {#each metaParts(u) as part, i}
                  {#if i > 0}<span class="sep" aria-hidden="true">·</span>{/if}
                  <span>{part}</span>
                {/each}
              </span>
            </div>
            <span class="go" aria-hidden="true">→</span>
          </a>
        </li>
      {/each}
    </ol>
  </section>
</main>

<style>
  main {
    --paper: #f3f6f4;
    --ink: #142326;
    --ink-soft: #3d5256;
    --ink-mute: #6a7f83;
    min-height: 100vh;
    padding: clamp(1.5rem, 4vw, 3.5rem);
    color: var(--ink);
    background: radial-gradient(100% 70% at 0% 0%, #d5e4df, transparent 55%), linear-gradient(180deg, #eef4f1, var(--paper));
  }

  header {
    margin-bottom: 2.5rem;
    max-width: 38rem;
  }

  .home-link {
    display: grid;
    gap: 0.2rem;
    margin-bottom: 1.15rem;
    padding: 0.95rem 1rem;
    text-decoration: none;
    color: var(--ink);
    border: 1px solid color-mix(in srgb, #214247 18%, transparent);
    border-radius: 0.7rem;
    background: color-mix(in srgb, #214247 10%, white);
    box-shadow: 0 10px 28px color-mix(in srgb, #214247 7%, transparent);
    transition:
      transform 0.2s ease,
      border-color 0.2s ease,
      background 0.2s ease;
  }

  .home-link:hover {
    transform: translateY(-1px);
    border-color: #214247;
    background: color-mix(in srgb, #214247 14%, white);
  }

  .home-link-kicker {
    font-size: 0.76rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--ink-mute);
  }

  .home-link strong {
    font-family: var(--display);
    font-size: clamp(1.1rem, 2.6vw, 1.45rem);
    font-weight: 500;
    line-height: 1.1;
  }

  .home-link-copy {
    color: var(--ink-soft);
    line-height: 1.45;
  }

  .eyebrow {
    margin: 0 0 0.75rem;
    font-size: 0.8rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--ink-mute);
  }

  h1 {
    margin: 0;
    font-family: var(--display);
    font-size: clamp(2.6rem, 8vw, 4.2rem);
    font-weight: 500;
    line-height: 0.95;
    letter-spacing: -0.03em;
  }

  .lede {
    margin: 1rem 0 0;
    color: var(--ink-soft);
    line-height: 1.5;
  }

  section {
    margin-bottom: 2.75rem;
  }

  ol {
    list-style: none;
    margin: 0;
    padding: 0;
    max-width: 42rem;
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
  }

  a {
    display: grid;
    grid-template-columns: 3.2rem 1fr auto;
    gap: 0.85rem;
    align-items: center;
    padding: 0.95rem 1rem;
    text-decoration: none;
    color: inherit;
    border: 1px solid color-mix(in srgb, var(--ink) 10%, transparent);
    border-radius: 0.55rem;
    background: #eef1ef;
    transition:
      border-color 0.2s ease,
      transform 0.2s ease,
      background 0.2s ease;
  }

  a:hover {
    border-color: var(--accent);
    background: #f5f7f6;
    transform: translateX(3px);
  }

  .rank {
    font-family: var(--display);
    font-size: 1.15rem;
    color: var(--accent);
  }

  .body {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    min-width: 0;
  }

  strong {
    font-family: var(--display);
    font-size: 1.2rem;
    font-weight: 500;
  }

  .meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.2rem 0.45rem;
    font-size: 0.82rem;
    color: var(--ink-mute);
    line-height: 1.35;
  }

  .meta .sep {
    color: color-mix(in srgb, var(--ink-mute) 70%, transparent);
  }

  .go {
    color: var(--accent);
    font-size: 1.1rem;
  }
</style>
