<script lang="ts">
  import type { CountItem } from "./types";

  type Props = {
    items: CountItem[];
  };

  let { items }: Props = $props();

  type Polaroid = {
    label: string;
    weight: number;
    w: number; // rem
    h: number;
    x: number;
    y: number;
    rot: number;
    delay: number;
  };

  const MAX = 24;
  /** Reject only when overlap area exceeds this fraction of the smaller card. */
  const MAX_OVERLAP = 0.22;
  // rem → % of wall (≈48rem × 28rem)
  const REM_X = 100 / 48;
  const REM_Y = 100 / 28;

  const placed = $derived.by((): Polaroid[] => {
    if (!items.length) return [];
    const ordered = [...items].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)).slice(0, MAX);
    const maxCount = Math.max(1, ...ordered.map((i) => i.count));

    const out: Polaroid[] = [];
    const boxes: { x: number; y: number; rw: number; rh: number }[] = [];

    for (let idx = 0; idx < ordered.length; idx++) {
      const item = ordered[idx];
      const weight = item.count / maxCount;
      const h = hash(item.label, idx * 41 + 7);
      const cardW = 4.8 + weight * 3.2;
      const cardH = cardW * 1.18;
      // Full card size in % of wall
      const rw = cardW * REM_X;
      const rh = cardH * REM_Y;

      const rankT = idx / Math.max(1, ordered.length - 1);
      const startR = 2 + rankT * 10;

      let best: { x: number; y: number; score: number } | null = null;

      const consider = (x: number, y: number) => {
        if (x - rw / 2 < 3 || x + rw / 2 > 97 || y - rh / 2 < 4 || y + rh / 2 > 96) return;
        const cand = { x, y, rw, rh };
        const worst = worstOverlap(cand, boxes);
        if (worst > MAX_OVERLAP) return;
        // Prefer less overlap, then closer to intended radius band
        const score = worst * 10 + Math.abs(distFromCenter(x, y) - (startR + 8)) * 0.02;
        if (!best || score < best.score) best = { x, y, score };
      };

      for (let r = startR; r <= 56; r += 1.35) {
        const spokes = Math.max(10, Math.floor(12 + r * 0.95));
        const phase = ((h % 360) / 360) * Math.PI * 2;
        for (let k = 0; k < spokes; k++) {
          const angle = phase + (k / spokes) * Math.PI * 2 + r * 0.12;
          consider(50 + Math.cos(angle) * r * 1.3, 50 + Math.sin(angle) * r * 1.05);
        }
      }

      // Denser fallback scan if spiral found nothing under threshold
      if (!best) {
        for (let attempt = 0; attempt < 120; attempt++) {
          const hh = hash(item.label, attempt * 97 + idx * 13);
          consider(10 + (hh % 80), 12 + ((hh >> 8) % 76));
        }
      }

      // Last resort: pick least-overlapping grid slot (never pile on center)
      if (!best) {
        let least = { x: 20, y: 20, score: Infinity };
        for (let gx = 12; gx <= 88; gx += 6) {
          for (let gy = 14; gy <= 86; gy += 6) {
            const cand = { x: gx, y: gy, rw, rh };
            const worst = worstOverlap(cand, boxes);
            if (worst < least.score) least = { x: gx, y: gy, score: worst };
          }
        }
        best = least;
      }

      boxes.push({ x: best.x, y: best.y, rw, rh });
      out.push({
        label: item.label,
        weight,
        w: cardW,
        h: cardH,
        x: best.x,
        y: best.y,
        rot: (((h >> 6) % 17) - 8) * 0.85,
        delay: 0.05 + idx * 0.045,
      });
    }

    return out;
  });

  function distFromCenter(x: number, y: number): number {
    const dx = x - 50;
    const dy = y - 50;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /** Overlap area / min(card areas). 0 = separate, 1 = one fully covers the other. */
  function overlapRatio(a: { x: number; y: number; rw: number; rh: number }, b: { x: number; y: number; rw: number; rh: number }): number {
    const ax1 = a.x - a.rw / 2;
    const ay1 = a.y - a.rh / 2;
    const ax2 = a.x + a.rw / 2;
    const ay2 = a.y + a.rh / 2;
    const bx1 = b.x - b.rw / 2;
    const by1 = b.y - b.rh / 2;
    const bx2 = b.x + b.rw / 2;
    const by2 = b.y + b.rh / 2;

    const ix = Math.max(0, Math.min(ax2, bx2) - Math.max(ax1, bx1));
    const iy = Math.max(0, Math.min(ay2, by2) - Math.max(ay1, by1));
    const inter = ix * iy;
    if (inter <= 0) return 0;
    const areaA = a.rw * a.rh;
    const areaB = b.rw * b.rh;
    return inter / Math.min(areaA, areaB);
  }

  function worstOverlap(cand: { x: number; y: number; rw: number; rh: number }, boxes: { x: number; y: number; rw: number; rh: number }[]): number {
    let worst = 0;
    for (const b of boxes) worst = Math.max(worst, overlapRatio(cand, b));
    return worst;
  }

  function hash(label: string, salt: number): number {
    let h = salt >>> 0;
    for (let i = 0; i < label.length; i++) h = (h * 33 + label.charCodeAt(i)) >>> 0;
    return h;
  }

  function initial(name: string): string {
    const t = name.trim();
    if (!t) return "?";
    const parts = t.split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return t.slice(0, 1).toUpperCase();
  }
</script>

<section class="people-panel">
  <div class="panel-head">
    <h2>People remembered</h2>
  </div>

  <div class="wall" aria-label="People remembered as memory cards">
    {#each placed as p, i}
      <article
        class="polaroid"
        style={`--x: ${p.x}%; --y: ${p.y}%; --rot: ${p.rot}deg; --w: ${p.w}rem; --h: ${p.h}rem; --wt: ${p.weight}; --d: ${p.delay}s; --i: ${i}`}
      >
        <div class="tape" aria-hidden="true"></div>
        <div class="frame">
          <div class="face" aria-hidden="true">
            <span class="initial">{initial(p.label)}</span>
          </div>
          <p class="name">{p.label}</p>
        </div>
      </article>
    {/each}
  </div>
</section>

<style>
  .people-panel {
    width: 100%;
    max-width: none;
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

  .wall {
    position: relative;
    width: 100%;
    height: clamp(24rem, 42vw, 36rem);
    border-radius: 0.75rem;
    background:
      radial-gradient(circle at 50% 45%, color-mix(in srgb, var(--accent) 10%, transparent), transparent 55%),
      repeating-linear-gradient(
        0deg,
        transparent,
        transparent 11px,
        color-mix(in srgb, var(--ink) 3.5%, transparent) 11px,
        color-mix(in srgb, var(--ink) 3.5%, transparent) 12px
      ),
      repeating-linear-gradient(
        90deg,
        transparent,
        transparent 11px,
        color-mix(in srgb, var(--ink) 3.5%, transparent) 11px,
        color-mix(in srgb, var(--ink) 3.5%, transparent) 12px
      ),
      #eef2ef;
    overflow: hidden;
  }

  .polaroid {
    position: absolute;
    left: var(--x);
    top: var(--y);
    width: var(--w);
    height: var(--h);
    transform: translate(-50%, -50%) rotate(var(--rot));
  }

  .tape {
    position: absolute;
    top: -0.35rem;
    left: 50%;
    width: 28%;
    height: 0.55rem;
    transform: translateX(-50%) rotate(-2deg);
    background: color-mix(in srgb, var(--accent) 18%, #f0e6c8);
    opacity: 0.75;
    box-shadow: 0 1px 1px color-mix(in srgb, var(--ink) 10%, transparent);
  }

  .frame {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    padding: 0.35rem 0.35rem 0.45rem;
    background: #fbfaf7;
    border: 1px solid color-mix(in srgb, var(--ink) 10%, transparent);
    box-shadow:
      0 10px 22px color-mix(in srgb, var(--ink) 12%, transparent),
      0 1px 0 color-mix(in srgb, white 80%, transparent) inset;
  }

  .face {
    flex: 1 1 auto;
    display: grid;
    place-items: center;
    min-height: 0;
    background: radial-gradient(
      circle at 40% 35%,
      color-mix(in srgb, var(--accent) calc(18% + var(--wt) * 28%), #dfe8e3),
      color-mix(in srgb, var(--ink) 8%, #c5d0cb)
    );
    border: 1px solid color-mix(in srgb, var(--ink) 8%, transparent);
  }

  .initial {
    font-family: var(--display);
    font-size: calc(var(--w) * 0.28);
    font-weight: 500;
    color: color-mix(in srgb, white 55%, var(--accent));
    text-shadow: 0 1px 0 color-mix(in srgb, var(--ink) 15%, transparent);
    line-height: 1;
    user-select: none;
  }

  .name {
    flex: 0 0 auto;
    margin: 0.35rem 0 0;
    font-family: var(--display);
    font-size: calc(0.62rem + var(--wt) * 0.45rem);
    font-weight: 500;
    text-align: center;
    color: var(--ink);
    line-height: 1.15;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
