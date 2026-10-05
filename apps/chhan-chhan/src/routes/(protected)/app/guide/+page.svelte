<script lang="ts">
  import AppNav from "$lib/components/app-nav.svelte";
  import AppSettings from "$lib/components/app-settings.svelte";
  import BrandMark from "$lib/components/brand-mark.svelte";

  type NoteTone = "sun" | "sky" | "blush" | "mint" | "cream";

  type Note = {
    id: string;
    title: string;
    tone: NoteTone;
    rotate: number;
    pin?: "tl" | "tr" | "tm";
    body: string[];
    wide?: boolean;
  };

  const notes: Note[] = [
    {
      id: "idea",
      title: "start here",
      tone: "cream",
      rotate: -2.5,
      pin: "tm",
      body: ["Tags → what is this?", "Spaces → how rows relate", "Everything else hangs off those two."],
    },
    {
      id: "ledger",
      title: "Ledger",
      tone: "sun",
      rotate: 1.8,
      pin: "tl",
      body: ["Filter · search · edit inline", "Calculate mode sums picks", "CSV export is in Control"],
    },
    {
      id: "tags",
      title: "Tags",
      tone: "sky",
      rotate: -3.2,
      pin: "tr",
      body: ["Labels only — stack many", "Seed / edit in Organize", "Smart tag copies to same merchant"],
    },
    {
      id: "spaces",
      title: "Spaces",
      tone: "blush",
      rotate: 2.4,
      pin: "tl",
      body: ["Create in Control", "Attach via row space icon", "People + items + settle on Space page"],
    },
    {
      id: "refund",
      title: "Refund",
      tone: "mint",
      rotate: -1.6,
      pin: "tr",
      body: ["Space for expense + credit", "Settle: allocate until open = 0", "Tag “Refund” optional"],
    },
    {
      id: "messy",
      title: "Many ↔ many",
      tone: "sun",
      rotate: 3.1,
      pin: "tm",
      body: ["Several spends, several returns", "One Space · split allocations", "Watch open remainder"],
    },
    {
      id: "import",
      title: "Import",
      tone: "cream",
      rotate: 1.2,
      pin: "tr",
      body: ["Control → Data", "Preview → confirm", "Wipe keeps tags/spaces defs"],
    },
    {
      id: "dash",
      title: "Dashboards",
      tone: "mint",
      rotate: -3.5,
      pin: "tm",
      body: ["Spend, trends, bills, goals", "Toggle widgets in the picker"],
    },
    {
      id: "control",
      title: "Control",
      tone: "blush",
      rotate: 2.0,
      pin: "tl",
      body: ["Gear, top right", "Accounts · Data · Organize", "Clear txns ≠ clear taxonomy"],
    },
    {
      id: "cheat",
      title: "remember",
      tone: "sun",
      rotate: -1.1,
      pin: "tr",
      wide: true,
      body: ["charts / filters → Tag", "link + settle bank rows → Space", "people + items → Space full mode"],
    },
  ];
</script>

<svelte:head><title>Guide · Chhan Chhan</title></svelte:head>

<header class="topbar">
  <div>
    <h1 class="brand-lockup">
      <BrandMark />
      <span class="brand-word"><span>CHHAN</span><span class="acid"> CHHAN</span></span>
    </h1>
    <AppNav />
  </div>
  <div class="actions">
    <AppSettings />
  </div>
</header>

<section class="board" aria-label="User guide canvas">
  <div class="board-grain" aria-hidden="true"></div>
  <header class="board-title">
    <span class="tape" aria-hidden="true"></span>
    <p class="board-kicker">pinboard</p>
    <h2>How to use Chhan Chhan</h2>
    <p class="board-sub">Short notes. Glance and go.</p>
  </header>

  <div class="notes">
    {#each notes as note, i (note.id)}
      <article id={note.id} class="note tone-{note.tone}" class:wide={note.wide} style="--rot: {note.rotate}deg; --delay: {i * 45}ms">
        <span class="pin pin-{note.pin ?? 'tm'}" aria-hidden="true"></span>
        <h3>{note.title}</h3>
        <ul>
          {#each note.body as line (line)}
            <li>{line}</li>
          {/each}
        </ul>
      </article>
    {/each}
  </div>
</section>

<style>
  .board {
    position: relative;
    flex: 0 0 auto;
    margin: 0.35rem 0 1.5rem;
    padding: 1.25rem clamp(0.75rem, 2.5vw, 1.5rem) 2rem;
    border: 1.5px solid color-mix(in srgb, var(--ink) 22%, transparent);
    border-radius: 6px 18px 8px 14px / 14px 6px 16px 8px;
    background:
      radial-gradient(ellipse 80% 50% at 12% 8%, color-mix(in srgb, var(--yellow) 28%, transparent), transparent 55%),
      radial-gradient(ellipse 70% 45% at 88% 12%, color-mix(in srgb, var(--blue) 22%, transparent), transparent 50%),
      radial-gradient(ellipse 60% 40% at 70% 90%, color-mix(in srgb, var(--pink) 18%, transparent), transparent 55%),
      linear-gradient(
        165deg,
        color-mix(in srgb, var(--paper, #f4efe6) 88%, var(--mix-wash, #fff)),
        color-mix(in srgb, var(--paper, #f4efe6) 72%, #c4b39a)
      );
    box-shadow: 2px 3px 0 color-mix(in srgb, var(--ink) 8%, transparent);
    /* Grow with notes; parent .content scrolls. overflow:hidden only clips grain to radius. */
    overflow: hidden;
  }

  .board-grain {
    pointer-events: none;
    position: absolute;
    inset: 0;
    opacity: 0.35;
    background-image:
      repeating-linear-gradient(
        0deg,
        transparent,
        transparent 11px,
        color-mix(in srgb, var(--ink) 4%, transparent) 11px,
        color-mix(in srgb, var(--ink) 4%, transparent) 12px
      ),
      repeating-linear-gradient(
        90deg,
        transparent,
        transparent 11px,
        color-mix(in srgb, var(--ink) 3%, transparent) 11px,
        color-mix(in srgb, var(--ink) 3%, transparent) 12px
      );
    mix-blend-mode: multiply;
  }

  .board-title {
    position: relative;
    z-index: 1;
    width: min(100%, 22rem);
    margin: 0 0 1.35rem;
    padding: 0.85rem 1.1rem 0.95rem;
    background: color-mix(in srgb, var(--mix-wash, #fff) 82%, var(--paper, #f4efe6));
    border: 1.5px solid color-mix(in srgb, var(--ink) 18%, transparent);
    border-radius: 3px 10px 4px 8px / 8px 3px 10px 4px;
    transform: rotate(-1.2deg);
    box-shadow: 1.5px 2px 0 color-mix(in srgb, var(--ink) 7%, transparent);
  }

  .tape {
    position: absolute;
    top: -0.45rem;
    left: 50%;
    width: 3.4rem;
    height: 0.85rem;
    margin-left: -1.7rem;
    background: color-mix(in srgb, var(--blue) 45%, transparent);
    border: 1px solid color-mix(in srgb, var(--ink) 12%, transparent);
    transform: rotate(-2deg);
    opacity: 0.85;
  }

  .board-kicker {
    margin: 0;
    font-family: var(--ui);
    font-size: 0.72rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--ink-muted, #5b5b5b);
  }

  .board-title h2 {
    margin: 0.15rem 0 0;
    font-family: var(--hand);
    font-size: clamp(1.55rem, 2.8vw, 2rem);
    font-weight: 400;
    line-height: 1.1;
    color: var(--ink, #1b1b1f);
  }

  .board-sub {
    margin: 0.35rem 0 0;
    font-family: var(--hand);
    font-size: 1.05rem;
    color: var(--ink-muted, #5b5b5b);
  }

  .notes {
    position: relative;
    z-index: 1;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(15.5rem, 1fr));
    gap: 1.15rem 1.35rem;
    align-items: start;
  }

  .note {
    position: relative;
    margin: 0;
    padding: 1.15rem 1rem 1rem;
    border: 1px solid color-mix(in srgb, var(--ink) 14%, transparent);
    border-radius: 2px 3px 2px 2px;
    font-family: var(--hand);
    color: var(--ink, #1b1b1f);
    transform: rotate(var(--rot, 0deg));
    box-shadow:
      1px 2px 0 color-mix(in srgb, var(--ink) 8%, transparent),
      inset 0 -10px 18px color-mix(in srgb, var(--ink) 4%, transparent);
    animation: note-in 420ms ease both;
    animation-delay: var(--delay, 0ms);
    transition:
      transform 160ms ease,
      box-shadow 160ms ease;
  }

  .note.wide {
    grid-column: span 2;
  }

  @media (max-width: 720px) {
    .notes {
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 12rem), 1fr));
    }

    .note.wide {
      grid-column: span 1;
    }
  }

  .note:hover,
  .note:focus-within {
    z-index: 2;
    transform: rotate(calc(var(--rot, 0deg) * 0.35)) translateY(-3px) scale(1.02);
    box-shadow:
      2px 5px 0 color-mix(in srgb, var(--ink) 10%, transparent),
      inset 0 -10px 18px color-mix(in srgb, var(--ink) 4%, transparent);
  }

  .tone-sun {
    background: linear-gradient(180deg, color-mix(in srgb, var(--yellow) 88%, #fff) 0%, color-mix(in srgb, var(--yellow) 72%, #e8c96a) 100%);
  }

  .tone-sky {
    background: linear-gradient(180deg, color-mix(in srgb, var(--blue) 78%, #fff) 0%, color-mix(in srgb, var(--blue) 62%, #7eb0c9) 100%);
  }

  .tone-blush {
    background: linear-gradient(180deg, color-mix(in srgb, var(--pink) 82%, #fff) 0%, color-mix(in srgb, var(--pink) 68%, #d9899a) 100%);
  }

  .tone-mint {
    background: linear-gradient(180deg, color-mix(in srgb, var(--green) 72%, #fff) 0%, color-mix(in srgb, var(--green) 58%, #7aaa7a) 100%);
  }

  .tone-cream {
    background: linear-gradient(
      180deg,
      color-mix(in srgb, var(--paper, #f4efe6) 92%, #fff) 0%,
      color-mix(in srgb, var(--paper, #f4efe6) 78%, #d9cdb8) 100%
    );
  }

  .pin {
    position: absolute;
    width: 0.72rem;
    height: 0.72rem;
    border-radius: 50%;
    background:
      radial-gradient(circle at 35% 30%, #fff8, transparent 45%),
      radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--ink) 55%, #8a3030), #4a1c1c);
    border: 1px solid color-mix(in srgb, var(--ink) 35%, transparent);
    box-shadow: 0 1px 0 color-mix(in srgb, var(--ink) 25%, transparent);
  }

  .pin-tm {
    top: -0.28rem;
    left: 50%;
    margin-left: -0.36rem;
  }

  .pin-tl {
    top: -0.22rem;
    left: 0.85rem;
  }

  .pin-tr {
    top: -0.22rem;
    right: 0.85rem;
  }

  .note h3 {
    margin: 0.15rem 0 0.55rem;
    font-size: 1.35rem;
    font-weight: 400;
    line-height: 1.15;
  }

  .note ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .note li {
    margin: 0 0 0.35rem;
    padding-left: 0.85rem;
    font-size: 1.05rem;
    line-height: 1.25;
    position: relative;
  }

  .note li::before {
    content: "·";
    position: absolute;
    left: 0;
    top: 0;
    opacity: 0.55;
  }

  .note li:last-child {
    margin-bottom: 0;
  }

  @keyframes note-in {
    from {
      opacity: 0;
      transform: rotate(var(--rot, 0deg)) translateY(10px) scale(0.97);
    }
    to {
      opacity: 1;
      transform: rotate(var(--rot, 0deg)) translateY(0) scale(1);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .note {
      animation: none;
    }

    .note:hover,
    .note:focus-within {
      transform: rotate(var(--rot, 0deg));
    }
  }
</style>
