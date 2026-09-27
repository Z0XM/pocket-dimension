<script lang="ts">
  import type { CountItem } from "./types";

  type Props = {
    items: CountItem[];
  };

  let { items }: Props = $props();

  type HangCard = {
    label: string;
    weight: number;
    fontRem: number;
    x: number;
    rope: number;
    rot: number;
    delay: number;
    /** approx half-width as % of hangar for overlap checks */
    halfW: number;
  };

  const MAX = 28;

  const cards = $derived.by((): HangCard[] => {
    if (!items.length) return [];
    const ordered = [...items].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)).slice(0, MAX);
    const maxCount = Math.max(1, ...ordered.map((i) => i.count));
    const n = ordered.length;

    // Spread across the rail with a mild shuffle
    const slots = ordered.map((_, i) => i);
    for (let i = slots.length - 1; i > 0; i--) {
      const h = hash(ordered[i].label, 9001 + i);
      const j = h % (i + 1);
      [slots[i], slots[j]] = [slots[j], slots[i]];
    }

    const raw: HangCard[] = ordered.map((item, idx) => {
      const weight = item.count / maxCount;
      const slot = slots[idx];
      const h = hash(item.label, idx * 17 + 3);
      const slotX = (slot + 0.5) / n;
      const jitter = ((h % 100) / 100 - 0.5) * (0.7 / Math.max(n, 1));
      const x = Math.min(0.95, Math.max(0.05, slotX + jitter));

      const fontRem = 0.78 + weight * 1.15;
      // Base rope from frequency + per-item jitter (helps same-frequency cards)
      const base = 16 + weight * 58;
      const sameFreqJitter = (((h >> 3) % 21) - 10) * 1.35;
      const rope = clamp(base + sameFreqJitter, 12, 84);
      const rot = (((h >> 9) % 15) - 7) * 0.55;

      // Card half-width as % of hangar (~48rem wide ≈ 768px; 1rem ≈ 2.1%)
      const widthRem = Math.max(fontRem * 2.2, item.label.length * fontRem * 0.58 + 1.1);
      const halfW = (widthRem * 2.1) / 2 / 100; // as fraction of field (0–1)

      return {
        label: item.label,
        weight,
        fontRem,
        x,
        rope,
        rot,
        delay: 0.05 + idx * 0.04,
        halfW,
      };
    });

    // Resolve overlaps: if two cards collide in x, push one further down (or up if room)
    // Prefer keeping higher frequency lower; otherwise alternate by hash.
    const sortedByRope = [...raw].sort((a, b) => a.rope - b.rope);
    for (let pass = 0; pass < 6; pass++) {
      let moved = false;
      for (let i = 0; i < sortedByRope.length; i++) {
        for (let j = i + 1; j < sortedByRope.length; j++) {
          const a = sortedByRope[i];
          const b = sortedByRope[j];
          if (!horizOverlap(a, b)) continue;
          if (!vertOverlap(a, b)) continue;

          // Separate vertically: move the lighter / currently higher one up a bit,
          // and the heavier / lower one down if needed.
          const [upper, lower] = a.rope <= b.rope ? [a, b] : [b, a];
          const gap = minVertGap(upper, lower);
          const need = gap - (lower.rope - upper.rope);
          if (need <= 0) continue;

          const pushDown = need * 0.65;
          const pushUp = need * 0.35;
          lower.rope = clamp(lower.rope + pushDown, 12, 86);
          upper.rope = clamp(upper.rope - pushUp, 10, 80);
          moved = true;
        }
      }
      if (!moved) break;
      sortedByRope.sort((a, b) => a.rope - b.rope);
    }

    // Extra stagger for remaining near-ties on the short end (top cluster)
    const topish = [...raw].filter((c) => c.weight < 0.45).sort((a, b) => a.x - b.x);
    for (let i = 1; i < topish.length; i++) {
      const prev = topish[i - 1];
      const cur = topish[i];
      if (!horizOverlap(prev, cur)) continue;
      if (Math.abs(cur.rope - prev.rope) >= minVertGap(prev, cur) * 0.85) continue;
      // Alternate short / a bit longer along the rail
      cur.rope = clamp(prev.rope + minVertGap(prev, cur) * (i % 2 === 0 ? 1 : 1.15), 10, 70);
    }

    return raw;
  });

  function horizOverlap(a: HangCard, b: HangCard): boolean {
    return Math.abs(a.x - b.x) < a.halfW + b.halfW + 0.012;
  }

  function cardHeightPct(c: HangCard): number {
    // padding + font → rough % of hangar height (~26rem)
    return ((c.fontRem * 1.35 + 0.7 + c.weight * 0.5) / 26) * 100;
  }

  function minVertGap(a: HangCard, b: HangCard): number {
    return (cardHeightPct(a) + cardHeightPct(b)) / 2 + 3.5;
  }

  function vertOverlap(a: HangCard, b: HangCard): boolean {
    return Math.abs(a.rope - b.rope) < minVertGap(a, b);
  }

  function clamp(n: number, lo: number, hi: number): number {
    return Math.min(hi, Math.max(lo, n));
  }

  function hash(label: string, salt: number): number {
    let h = salt >>> 0;
    for (let i = 0; i < label.length; i++) h = (h * 33 + label.charCodeAt(i)) >>> 0;
    return h;
  }
</script>

<section class="words-panel">
  <div class="panel-head">
    <h2>Your dictionary</h2>
  </div>

  <div class="hangar" aria-label="Hanging word cards">
    <div class="rail" aria-hidden="true">
      <span class="rail-line"></span>
      <span class="rail-caps">
        <i></i><i></i>
      </span>
    </div>
    {#each cards as card}
      <div
        class="hang"
        style={`--x: ${card.x * 100}%; --rope: ${card.rope}%; --rot: ${card.rot}deg; --s: ${card.fontRem}rem; --w: ${card.weight}; --d: ${card.delay}s`}
      >
        <span class="string" aria-hidden="true"></span>
        <span class="knot" aria-hidden="true"></span>
        <div class="card">
          <span class="word">{card.label}</span>
        </div>
      </div>
    {/each}
  </div>
</section>

<style>
  .words-panel {
    max-width: 48rem;
    margin-bottom: 3.25rem;
  }

  .panel-head {
    margin-bottom: 0.85rem;
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

  .hangar {
    position: relative;
    width: 100%;
    height: clamp(22rem, 52vw, 30rem);
    border-radius: 0.75rem;
    background:
      linear-gradient(180deg, color-mix(in srgb, var(--accent) 8%, #eef4f1) 0%, transparent 28%),
      radial-gradient(90% 50% at 50% 0%, color-mix(in srgb, var(--ink) 6%, transparent), transparent 55%);
    overflow: hidden;
  }

  .rail {
    position: absolute;
    top: 0.95rem;
    left: 3.5%;
    right: 3.5%;
    height: 10px;
    pointer-events: none;
  }

  .rail-line {
    position: absolute;
    left: 0;
    right: 0;
    top: 50%;
    height: 1px;
    transform: translateY(-50%);
    background: linear-gradient(
      90deg,
      transparent 0%,
      color-mix(in srgb, var(--accent) 35%, #9a7b5c) 6%,
      color-mix(in srgb, var(--ink) 22%, #b08a62) 50%,
      color-mix(in srgb, var(--accent) 35%, #9a7b5c) 94%,
      transparent 100%
    );
    opacity: 0.85;
  }

  .rail-line::before,
  .rail-line::after {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    height: 1px;
    opacity: 0.35;
  }

  .rail-line::before {
    top: -2px;
    background: linear-gradient(
      90deg,
      transparent,
      color-mix(in srgb, white 55%, #c4a882) 10%,
      color-mix(in srgb, white 40%, #c4a882) 90%,
      transparent
    );
  }

  .rail-line::after {
    top: 2px;
    background: linear-gradient(
      90deg,
      transparent,
      color-mix(in srgb, var(--ink) 18%, transparent) 12%,
      color-mix(in srgb, var(--ink) 12%, transparent) 88%,
      transparent
    );
  }

  .rail-caps {
    position: absolute;
    inset: 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 0.1rem;
  }

  .rail-caps i {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    border: 1px solid color-mix(in srgb, var(--ink) 28%, #9a7b5c);
    background:
      radial-gradient(circle at 35% 30%, color-mix(in srgb, white 55%, transparent), transparent 55%), color-mix(in srgb, #e8dcc8 70%, var(--accent));
    box-shadow: 0 1px 2px color-mix(in srgb, var(--ink) 12%, transparent);
  }

  .hang {
    position: absolute;
    top: 1.05rem;
    left: var(--x);
    height: var(--rope);
    display: flex;
    flex-direction: column;
    align-items: center;
    transform: translateX(-50%);
    transform-origin: top center;
    opacity: 0;
    animation:
      drop-in 0.7s cubic-bezier(0.22, 1, 0.36, 1) forwards,
      sway 4.5s ease-in-out infinite;
    animation-delay: var(--d), calc(var(--d) + 0.7s);
  }

  .string {
    position: relative;
    flex: 1 1 auto;
    width: 1px;
    min-height: 0.5rem;
    background: linear-gradient(
      180deg,
      color-mix(in srgb, var(--accent) 25%, #a28462) 0%,
      color-mix(in srgb, var(--ink) 18%, #b59872) 55%,
      color-mix(in srgb, var(--ink) 12%, #c4a882) 100%
    );
    opacity: 0.72;
  }

  .string::before {
    content: "";
    position: absolute;
    inset: 0 auto 0 -1px;
    width: 1px;
    background: linear-gradient(180deg, color-mix(in srgb, white 50%, transparent), transparent 70%);
    opacity: 0.5;
  }

  .knot {
    position: relative;
    width: 6px;
    height: 6px;
    margin: 0.05rem 0 0.28rem;
    border-radius: 50%;
    border: 1px solid color-mix(in srgb, var(--ink) 22%, #9a7b5c);
    background:
      radial-gradient(circle at 30% 28%, color-mix(in srgb, white 60%, transparent), transparent 50%), color-mix(in srgb, #e6d7c0 65%, var(--accent));
    box-shadow: 0 1px 2px color-mix(in srgb, var(--ink) 14%, transparent);
  }

  .knot::after {
    content: "";
    position: absolute;
    left: 50%;
    top: 50%;
    width: 2px;
    height: 2px;
    border-radius: 50%;
    transform: translate(-50%, -50%);
    background: color-mix(in srgb, var(--ink) 25%, #8a6a4a);
    opacity: 0.55;
  }

  .card {
    flex: 0 0 auto;
    padding: calc(0.35rem + var(--w) * 0.35rem) calc(0.55rem + var(--w) * 0.55rem);
    border-radius: 0.35rem;
    background: color-mix(in srgb, white 82%, #f3f6f4);
    border: 1px solid color-mix(in srgb, var(--ink) 12%, transparent);
    box-shadow:
      0 6px 14px color-mix(in srgb, var(--ink) 10%, transparent),
      0 1px 0 color-mix(in srgb, white 70%, transparent) inset;
    transform: rotate(var(--rot));
    transform-origin: top center;
  }

  .word {
    display: block;
    font-family: var(--display);
    font-size: var(--s);
    font-weight: 500;
    line-height: 1.1;
    letter-spacing: -0.02em;
    color: color-mix(in srgb, var(--ink) calc(48% + var(--w) * 42%), var(--accent));
    white-space: nowrap;
  }

  @keyframes drop-in {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(-12px);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }

  @keyframes sway {
    0%,
    100% {
      transform: translateX(-50%) rotate(calc(var(--rot) * 0.15));
    }
    50% {
      transform: translateX(-50%) rotate(calc(var(--rot) * -0.2));
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .hang {
      animation: drop-in 0.01s linear forwards;
      opacity: 1;
    }
  }
</style>
