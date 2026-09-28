<script lang="ts">
  import type { CountItem } from "./types";

  type Props = {
    items: CountItem[];
    /** Used in the download filename (slug or display name). */
    exportName?: string;
  };

  let { items, exportName = "stars" }: Props = $props();

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

  const MIN_DENSITY = 55;
  const MAX_DENSITY = 140;
  /** 100 = default card size; lower packs tighter / rearranges. */
  let densityPct = $state(100);
  let wallEl = $state<HTMLDivElement | null>(null);
  let downloading = $state(false);

  const density = $derived(densityPct / 100);

  const placed = $derived.by((): Polaroid[] => {
    if (!items.length) return [];
    const scale = density;
    const ordered = [...items].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)).slice(0, MAX);
    const maxCount = Math.max(1, ...ordered.map((i) => i.count));

    const out: Polaroid[] = [];
    const boxes: { x: number; y: number; rw: number; rh: number }[] = [];

    for (let idx = 0; idx < ordered.length; idx++) {
      const item = ordered[idx];
      const weight = item.count / maxCount;
      const h = hash(item.label, idx * 41 + 7);
      const cardW = (4.8 + weight * 3.2) * scale;
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

  function adjustDensity(delta: number) {
    densityPct = Math.max(MIN_DENSITY, Math.min(MAX_DENSITY, densityPct + delta));
  }

  function setDensity(value: number) {
    densityPct = Math.max(MIN_DENSITY, Math.min(MAX_DENSITY, Math.round(value)));
  }

  function safeFileStem(name: string): string {
    return (
      name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 48) || "stars"
    );
  }

  function remToPx(rem: number, rootPx: number): number {
    return rem * rootPx;
  }

  async function download() {
    const el = wallEl;
    if (!el || !placed.length || downloading) return;
    downloading = true;
    try {
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
      const rect = el.getBoundingClientRect();
      const W = Math.max(1, Math.round(rect.width));
      const H = Math.max(1, Math.round(rect.height));
      const scale = 2;
      const canvas = document.createElement("canvas");
      canvas.width = W * scale;
      canvas.height = H * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(scale, scale);

      // Wall background (match CSS)
      const accent = getComputedStyle(el).getPropertyValue("--accent").trim() || "#214247";
      const ink = getComputedStyle(document.documentElement).getPropertyValue("--ink").trim() || "#1a1f1c";
      ctx.fillStyle = "#eef2ef";
      ctx.fillRect(0, 0, W, H);

      // Soft accent wash
      const wash = ctx.createRadialGradient(W * 0.5, H * 0.45, 0, W * 0.5, H * 0.45, Math.max(W, H) * 0.45);
      wash.addColorStop(0, hexToRgba(accent, 0.1));
      wash.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = wash;
      ctx.fillRect(0, 0, W, H);

      // Grid lines
      ctx.strokeStyle = hexToRgba(ink, 0.035);
      ctx.lineWidth = 1;
      const step = (12 / 16) * (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16);
      for (let x = 0; x <= W; x += step) {
        ctx.beginPath();
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, H);
        ctx.stroke();
      }
      for (let y = 0; y <= H; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(W, y + 0.5);
        ctx.stroke();
      }

      const rootPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;

      for (const p of placed) {
        const cx = (p.x / 100) * W;
        const cy = (p.y / 100) * H;
        const pw = remToPx(p.w, rootPx);
        const ph = remToPx(p.h, rootPx);
        const rot = (p.rot * Math.PI) / 180;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(rot);

        // Shadow
        ctx.fillStyle = "rgba(0,0,0,0.12)";
        ctx.fillRect(-pw / 2 + 2, -ph / 2 + 4, pw, ph);

        // Frame
        ctx.fillStyle = "#fbfaf7";
        ctx.strokeStyle = hexToRgba(ink, 0.1);
        ctx.lineWidth = 1;
        ctx.fillRect(-pw / 2, -ph / 2, pw, ph);
        ctx.strokeRect(-pw / 2, -ph / 2, pw, ph);

        // Tape
        const tapeW = pw * 0.28;
        const tapeH = remToPx(0.55, rootPx);
        ctx.save();
        ctx.translate(0, -ph / 2 - remToPx(0.1, rootPx));
        ctx.rotate((-2 * Math.PI) / 180);
        ctx.fillStyle = mixHex(accent, "#f0e6c8", 0.18);
        ctx.globalAlpha = 0.75;
        ctx.fillRect(-tapeW / 2, -tapeH / 2, tapeW, tapeH);
        ctx.restore();
        ctx.globalAlpha = 1;

        // Face
        const pad = remToPx(0.35, rootPx);
        const faceX = -pw / 2 + pad;
        const faceY = -ph / 2 + pad;
        const faceW = pw - pad * 2;
        const nameBlock = remToPx(0.35, rootPx) + remToPx(0.62 + p.weight * 0.45, rootPx) * 1.15 + remToPx(0.1, rootPx);
        const faceH = ph - pad - remToPx(0.45, rootPx) - nameBlock;
        const faceGrad = ctx.createRadialGradient(
          faceX + faceW * 0.4,
          faceY + faceH * 0.35,
          0,
          faceX + faceW * 0.5,
          faceY + faceH * 0.5,
          Math.max(faceW, faceH) * 0.7
        );
        faceGrad.addColorStop(0, mixHex(accent, "#dfe8e3", 0.18 + p.weight * 0.28));
        faceGrad.addColorStop(1, mixHex(ink, "#c5d0cb", 0.08));
        ctx.fillStyle = faceGrad;
        ctx.fillRect(faceX, faceY, faceW, Math.max(8, faceH));
        ctx.strokeStyle = hexToRgba(ink, 0.08);
        ctx.strokeRect(faceX, faceY, faceW, Math.max(8, faceH));

        // Initial
        const ini = initial(p.label);
        ctx.fillStyle = mixHex("#ffffff", accent, 0.55);
        ctx.font = `500 ${pw * 0.28}px Fraunces, Georgia, serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(ini, 0, faceY + Math.max(8, faceH) / 2);

        // Name
        const nameSize = remToPx(0.62 + p.weight * 0.45, rootPx);
        ctx.fillStyle = ink;
        ctx.font = `500 ${nameSize}px Fraunces, Georgia, serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        const nameY = faceY + Math.max(8, faceH) + remToPx(0.35, rootPx);
        const maxNameW = faceW;
        let name = p.label;
        while (ctx.measureText(name).width > maxNameW && name.length > 1) {
          name = name.slice(0, -2) + "…";
        }
        ctx.fillText(name, 0, nameY);

        ctx.restore();
      }

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${safeFileStem(exportName)}-stars.png`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      downloading = false;
    }
  }

  function hexToRgba(hex: string, alpha: number): string {
    const m = hex.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (!m) return `rgba(0,0,0,${alpha})`;
    let h = m[1];
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function mixHex(a: string, b: string, tA: number): string {
    const parse = (hex: string) => {
      const m = hex.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
      if (!m) return [0, 0, 0];
      let h = m[1];
      if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    };
    const [ar, ag, ab] = parse(a);
    const [br, bg, bb] = parse(b);
    const t = Math.max(0, Math.min(1, tA));
    const r = Math.round(ar * t + br * (1 - t));
    const g = Math.round(ag * t + bg * (1 - t));
    const bl = Math.round(ab * t + bb * (1 - t));
    return `rgb(${r},${g},${bl})`;
  }
</script>

<section class="people-panel">
  <div class="panel-head">
    <h2>Your stars</h2>
    <div class="actions">
      <div class="density-ctrl" title="Card size — changes how stars are arranged">
        <span class="density-label">Size</span>
        <button type="button" class="btn" onclick={() => adjustDensity(-5)} disabled={densityPct <= MIN_DENSITY} aria-label="Smaller cards"
          >−</button
        >
        <input
          class="density-range"
          type="range"
          min={MIN_DENSITY}
          max={MAX_DENSITY}
          step="5"
          value={densityPct}
          oninput={(e) => setDensity(Number((e.currentTarget as HTMLInputElement).value))}
          aria-label="Star card size"
        />
        <span class="density-value">{densityPct}%</span>
        <button type="button" class="btn" onclick={() => adjustDensity(5)} disabled={densityPct >= MAX_DENSITY} aria-label="Larger cards"
          >+</button
        >
      </div>
      <button type="button" class="btn primary" onclick={download} disabled={!placed.length || downloading}>
        {downloading ? "Preparing…" : "Download"}
      </button>
    </div>
  </div>

  <div class="wall" bind:this={wallEl} aria-label="Your stars as memory cards">
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
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem 1rem;
    margin-bottom: 0.85rem;
  }

  .panel-head h2 {
    margin: 0;
    font-family: var(--display);
    font-size: 1.7rem;
    font-weight: 500;
    color: var(--ink);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.55rem 0.75rem;
  }

  .density-ctrl {
    display: flex;
    align-items: center;
    gap: 0.3rem;
  }

  .density-label {
    padding: 0 0.2rem;
    font-size: 0.78rem;
    color: color-mix(in srgb, var(--ink) 55%, transparent);
    user-select: none;
  }

  .density-value {
    min-width: 2.6rem;
    text-align: center;
    font-size: 0.85rem;
    font-variant-numeric: tabular-nums;
    color: var(--ink-soft);
    user-select: none;
  }

  .density-range {
    width: 6.5rem;
    accent-color: var(--accent);
    cursor: pointer;
  }

  .btn {
    padding: 0.45rem 0.85rem;
    border: 1px solid color-mix(in srgb, var(--ink) 16%, transparent);
    border-radius: 0.5rem;
    background: color-mix(in srgb, white 75%, transparent);
    color: var(--ink-soft);
    font-family: var(--sans);
    font-size: 0.85rem;
    cursor: pointer;
  }

  .btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .btn.primary {
    border-color: color-mix(in srgb, var(--accent) 45%, transparent);
    background: color-mix(in srgb, var(--accent) 12%, white);
    color: var(--accent);
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

  @media (max-width: 520px) {
    .density-range {
      width: 4.5rem;
    }
  }
</style>
