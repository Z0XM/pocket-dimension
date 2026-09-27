<script lang="ts">
  import type { CountItem } from "./types";

  type Props = {
    items: CountItem[];
  };

  let { items }: Props = $props();

  type Placed = {
    label: string;
    sizeRem: number;
    x: number; // % of container
    y: number;
    rot: number;
  };

  const FIELD_W = 100;
  const FIELD_H = 100;
  // Approximate rem→% conversion inside the field (field ~ 18rem tall, ~40rem wide)
  const REM_TO_X = 2.55;
  const REM_TO_Y = 5.6;
  const PAD = 3.4;

  function sizeRem(count: number, maxCount: number): number {
    const t = count / maxCount;
    return 1.15 + t * 2.55; // ~1.15rem → 3.7rem
  }

  function overlaps(a: { x: number; y: number; rx: number; ry: number }, b: { x: number; y: number; rx: number; ry: number }): boolean {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const minDist = a.rx + b.rx + PAD;
    // Elliptical-ish: weight x/y by field aspect via separate radii
    const nx = dx / ((a.rx + b.rx) / 2 + PAD);
    const ny = dy / ((a.ry + b.ry) / 2 + PAD * 1.15);
    return nx * nx + ny * ny < 1;
  }

  function hash(label: string, salt: number): number {
    let h = salt >>> 0;
    for (let i = 0; i < label.length; i++) h = (h * 33 + label.charCodeAt(i)) >>> 0;
    return h;
  }

  const placed = $derived.by((): Placed[] => {
    if (!items.length) return [];
    const maxCount = Math.max(1, ...items.map((i) => i.count));
    const ordered = [...items].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

    const out: Placed[] = [];
    const boxes: { x: number; y: number; rx: number; ry: number }[] = [];

    for (let idx = 0; idx < ordered.length; idx++) {
      const item = ordered[idx];
      const s = sizeRem(item.count, maxCount);
      const rx = (s * REM_TO_X) / 2;
      const ry = (s * REM_TO_Y) / 2;
      const h = hash(item.label, idx * 9176 + 13);

      // Prefer center for frequent items; allow larger starting radius as we go out
      const rankT = idx / Math.max(1, ordered.length - 1);
      const startR = 4 + rankT * 12;
      const maxR = 52;

      let best: { x: number; y: number; rot: number } | null = null;

      // Spiral / radial search: angle spin + growing radius
      outer: for (let r = startR; r <= maxR; r += 1.55) {
        const spokes = Math.max(8, Math.floor(9 + r * 0.75));
        const phase = ((h % 360) / 360) * Math.PI * 2;
        for (let k = 0; k < spokes; k++) {
          const angle = phase + (k / spokes) * Math.PI * 2 + r * 0.17;
          // Slight ellipse so field fills wider better
          const x = 50 + Math.cos(angle) * r * 1.2;
          const y = 50 + Math.sin(angle) * r * 0.95;
          if (x - rx < 2 || x + rx > FIELD_W - 2 || y - ry < 3 || y + ry > FIELD_H - 3) continue;

          const cand = { x, y, rx, ry };
          if (boxes.some((b) => overlaps(cand, b))) continue;

          best = { x, y, rot: ((h >> 8) % 17) - 8 };
          break outer;
        }
      }

      // Fallback: nudge around center until free-ish
      if (!best) {
        for (let attempt = 0; attempt < 80; attempt++) {
          const hh = hash(item.label, attempt * 131 + idx);
          const x = 8 + (hh % 84);
          const y = 10 + ((hh >> 9) % 80);
          const cand = { x, y, rx, ry };
          if (x - rx < 2 || x + rx > 98 || y - ry < 3 || y + ry > 97) continue;
          if (boxes.some((b) => overlaps(cand, b))) continue;
          best = { x, y, rot: (hh % 15) - 7 };
          break;
        }
      }

      if (!best) {
        best = { x: 50, y: 50, rot: 0 };
      }

      boxes.push({ x: best.x, y: best.y, rx, ry });
      out.push({
        label: item.label,
        sizeRem: s,
        x: best.x,
        y: best.y,
        rot: best.rot,
      });
    }

    return out;
  });
</script>

<section class="mood-panel">
  <div class="panel-head">
    <h2>Mood board</h2>
  </div>

  <div class="constellation" aria-label="Emoji constellation">
    {#each placed as item, i}
      <span style={`--s: ${item.sizeRem}rem; --x: ${item.x}%; --y: ${item.y}%; --r: ${item.rot}deg; --i: ${i}`}>
        {item.label}
      </span>
    {/each}
  </div>
</section>

<style>
  .mood-panel {
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

  .panel-head p {
    margin: 0.35rem 0 0;
    color: var(--ink-mute);
    font-size: 0.95rem;
  }

  .constellation {
    position: relative;
    width: 100%;
    height: clamp(20rem, 38vw, 32rem);
    border-radius: 0.75rem;
    background:
      radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--accent) 14%, transparent), transparent 55%),
      radial-gradient(circle at 18% 22%, color-mix(in srgb, var(--accent) 8%, transparent), transparent 40%),
      radial-gradient(circle at 82% 78%, color-mix(in srgb, var(--accent) 6%, transparent), transparent 38%);
    overflow: hidden;
  }

  .constellation span {
    position: absolute;
    left: var(--x);
    top: var(--y);
    font-size: var(--s);
    line-height: 1;
    transform: translate(-50%, -50%) rotate(var(--r));
    user-select: none;
  }
</style>
