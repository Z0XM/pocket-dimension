<script lang="ts">
  import { onDestroy } from "svelte";
  import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "$lib/components/ui/dropdown-menu";
  import type { CountItem } from "./types";
  import PhotoCropModal from "./PhotoCropModal.svelte";

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
    z: number;
  };

  type BoxPct = { x1: number; y1: number; x2: number; y2: number };

  const MAX = 24;
  /** Reject only when overlap area exceeds this fraction of the smaller card. */
  const MAX_OVERLAP = 0.22;
  /** Assumed wall width at 100% for rem→% placement. */
  const BASE_WALL_W_REM = 48;
  /** Name strip = bottom fraction of each card (for layering). */
  const NAME_STRIP = 0.22;

  const MIN_DENSITY = 55;
  const MAX_DENSITY = 140;
  const MIN_WIDTH_PCT = 70;
  const MAX_WIDTH_PCT = 100;
  const MIN_HEIGHT_REM = 20;
  const MAX_HEIGHT_REM = 42;

  let densityPct = $state(100);
  let wallWidthPct = $state(100);
  let wallHeightRem = $state(28);
  let layoutWallHeightRem = $state(28);
  let wallEl = $state<HTMLDivElement | null>(null);
  /** Measured wall width in rem (falls back to BASE_WALL_W_REM * width%). */
  let measuredWallWRem = $state(BASE_WALL_W_REM);
  let downloading = $state(false);
  let fileInputEl = $state<HTMLInputElement | null>(null);
  let peopleMenuOpen = $state(false);
  let heightApplyTimer: ReturnType<typeof setTimeout> | null = null;
  let hideApplyTimer: ReturnType<typeof setTimeout> | null = null;
  let rearranging = $state(false);

  let hiddenLabels = $state<Set<string>>(new Set());
  let layoutHiddenLabels = $state<Set<string>>(new Set());
  let photos = $state<Record<string, string>>({});

  let cropOpen = $state(false);
  let cropSrc = $state("");
  let cropLabel = $state("");
  let pendingPickLabel = $state<string | null>(null);

  const density = $derived(densityPct / 100);
  const remX = $derived(100 / Math.max(8, measuredWallWRem));
  const remY = $derived(100 / layoutWallHeightRem);
  /** Approximate face W/H above the name strip (card aspect 1.18, ~22% name). */
  const faceAspect = 1 / (1.18 * (1 - NAME_STRIP));
  const storageKey = $derived(`hwyd-stars-hidden:${exportName}`);
  const hiddenCount = $derived(hiddenLabels.size);

  $effect(() => {
    const el = wallEl;
    if (!el || typeof ResizeObserver === "undefined") return;
    const rootPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      if (w > 0) measuredWallWRem = w / rootPx;
    });
    ro.observe(el);
    measuredWallWRem = (el.getBoundingClientRect().width || BASE_WALL_W_REM * rootPx) / rootPx;
    return () => ro.disconnect();
  });

  $effect(() => {
    const key = storageKey;
    if (typeof sessionStorage === "undefined") return;
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) {
        hiddenLabels = new Set();
        layoutHiddenLabels = new Set();
        return;
      }
      const arr = JSON.parse(raw) as unknown;
      if (Array.isArray(arr)) {
        const next = new Set(arr.filter((x): x is string => typeof x === "string"));
        hiddenLabels = next;
        layoutHiddenLabels = new Set(next);
      } else {
        hiddenLabels = new Set();
        layoutHiddenLabels = new Set();
      }
    } catch {
      hiddenLabels = new Set();
      layoutHiddenLabels = new Set();
    }
  });

  function persistHidden(next: Set<string>) {
    hiddenLabels = next;
    if (typeof sessionStorage === "undefined") return;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify([...next]));
    } catch {
      /* ignore */
    }
  }

  const peopleList = $derived([...items].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)));

  const visibleItems = $derived(peopleList.filter((i) => !layoutHiddenLabels.has(i.label)).slice(0, MAX));

  const placed = $derived.by((): Polaroid[] => {
    if (!visibleItems.length) return [];
    const scale = density;
    const rx = remX;
    const ry = remY;
    const ordered = visibleItems;
    const maxCount = Math.max(1, ...ordered.map((i) => i.count));

    const out: Polaroid[] = [];
    const boxes: { x: number; y: number; rw: number; rh: number }[] = [];

    for (let idx = 0; idx < ordered.length; idx++) {
      const item = ordered[idx];
      const weight = item.count / maxCount;
      const h = hash(item.label, idx * 41 + 7);
      const cardW = (4.8 + weight * 3.2) * scale;
      const cardH = cardW * 1.18;
      const rw = cardW * rx;
      const rh = cardH * ry;

      const rankT = idx / Math.max(1, ordered.length - 1);
      const startR = 2 + rankT * 10;

      let best: { x: number; y: number; score: number } | null = null;

      const consider = (x: number, y: number) => {
        if (x - rw / 2 < 3 || x + rw / 2 > 97 || y - rh / 2 < 4 || y + rh / 2 > 96) return;
        const cand = { x, y, rw, rh };
        const worst = worstOverlap(cand, boxes);
        if (worst > MAX_OVERLAP) return;
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

      if (!best) {
        for (let attempt = 0; attempt < 120; attempt++) {
          const hh = hash(item.label, attempt * 97 + idx * 13);
          consider(10 + (hh % 80), 12 + ((hh >> 8) % 76));
        }
      }

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
        z: idx + 1,
      });
    }

    return assignNameSafeZ(out, rx, ry);
  });

  function cardBoxPct(p: Polaroid, rx: number, ry: number): BoxPct {
    const rw = p.w * rx;
    const rh = p.h * ry;
    return { x1: p.x - rw / 2, y1: p.y - rh / 2, x2: p.x + rw / 2, y2: p.y + rh / 2 };
  }

  function nameStripPct(p: Polaroid, rx: number, ry: number): BoxPct {
    const box = cardBoxPct(p, rx, ry);
    const midY = box.y2 - (box.y2 - box.y1) * NAME_STRIP;
    return { x1: box.x1, y1: midY, x2: box.x2, y2: box.y2 };
  }

  function rectsOverlap(a: BoxPct, b: BoxPct): boolean {
    return a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;
  }

  /** If A covers B's name strip, B sits above A. Cycles break via stable score sort. */
  function assignNameSafeZ(cards: Polaroid[], rx: number, ry: number): Polaroid[] {
    const n = cards.length;
    if (n <= 1) return cards;

    const preferAbove: boolean[][] = Array.from({ length: n }, () => Array(n).fill(false));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        if (rectsOverlap(cardBoxPct(cards[i], rx, ry), nameStripPct(cards[j], rx, ry))) {
          preferAbove[j][i] = true;
        }
      }
    }

    // Score = how many cards this one should sit above; stable by index then label
    const order = cards.map((_, i) => i);
    order.sort((ia, ib) => {
      let scoreA = 0;
      let scoreB = 0;
      for (let k = 0; k < n; k++) {
        if (preferAbove[ia][k]) scoreA++;
        if (preferAbove[ib][k]) scoreB++;
      }
      if (scoreA !== scoreB) return scoreA - scoreB;
      const byLabel = cards[ia].label.localeCompare(cards[ib].label);
      if (byLabel !== 0) return byLabel;
      return ia - ib;
    });

    const zRank = new Array<number>(n);
    order.forEach((idx, rank) => {
      zRank[idx] = rank + 1;
    });

    // Enforce direct edges when stable sort left a conflict (acyclic bumps only)
    let changed = true;
    let guard = 0;
    while (changed && guard++ < n * n) {
      changed = false;
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          if (!preferAbove[i][j] || zRank[i] > zRank[j]) continue;
          // Skip mutual/cyclic edges — stable order already decided those
          if (preferAbove[j][i]) continue;
          zRank[i] = zRank[j] + 1;
          changed = true;
        }
      }
    }
    return cards.map((c, i) => ({ ...c, z: zRank[i] }));
  }

  function distFromCenter(x: number, y: number): number {
    return Math.sqrt((x - 50) ** 2 + (y - 50) ** 2);
  }

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
    return inter / Math.min(a.rw * a.rh, b.rw * b.rh);
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

  function clamp(n: number, lo: number, hi: number) {
    return Math.max(lo, Math.min(hi, n));
  }

  function adjustDensity(delta: number) {
    densityPct = clamp(densityPct + delta, MIN_DENSITY, MAX_DENSITY);
  }
  function setDensity(value: number) {
    densityPct = clamp(Math.round(value), MIN_DENSITY, MAX_DENSITY);
  }
  function setWallWidth(value: number) {
    wallWidthPct = clamp(Math.round(value), MIN_WIDTH_PCT, MAX_WIDTH_PCT);
  }
  function setWallHeight(value: number) {
    const next = clamp(Math.round(value), MIN_HEIGHT_REM, MAX_HEIGHT_REM);
    wallHeightRem = next;
    if (heightApplyTimer) clearTimeout(heightApplyTimer);
    heightApplyTimer = setTimeout(() => {
      layoutWallHeightRem = next;
      heightApplyTimer = null;
    }, 100);
  }

  function toggleHide(label: string) {
    const next = new Set(hiddenLabels);
    if (next.has(label)) next.delete(label);
    else next.add(label);
    persistHidden(next);
    rearranging = true;
    if (hideApplyTimer) clearTimeout(hideApplyTimer);
    hideApplyTimer = setTimeout(() => {
      layoutHiddenLabels = new Set(next);
      rearranging = false;
      hideApplyTimer = null;
    }, 120);
  }

  function setPhoto(label: string, url: string) {
    const prev = photos[label];
    if (prev) URL.revokeObjectURL(prev);
    photos = { ...photos, [label]: url };
  }

  function openPhotoPicker(label: string) {
    pendingPickLabel = label;
    fileInputEl?.click();
  }

  function onFileChosen(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    const label = pendingPickLabel;
    pendingPickLabel = null;
    if (!file || !label) return;
    const mimeOk = !file.type || file.type.startsWith("image/");
    if (!mimeOk) return;
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    cropSrc = URL.createObjectURL(file);
    cropLabel = label;
    cropOpen = true;
  }

  function onCropConfirm(url: string) {
    setPhoto(cropLabel, url);
    closeCrop();
  }

  function closeCrop() {
    cropOpen = false;
    cropLabel = "";
    const stale = cropSrc;
    cropSrc = "";
    if (stale) queueMicrotask(() => URL.revokeObjectURL(stale));
  }

  onDestroy(() => {
    if (heightApplyTimer) clearTimeout(heightApplyTimer);
    if (hideApplyTimer) clearTimeout(hideApplyTimer);
    for (const url of Object.values(photos)) URL.revokeObjectURL(url);
    if (cropSrc) URL.revokeObjectURL(cropSrc);
  });

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

  function loadImage(src: string): Promise<HTMLImageElement | null> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  async function download() {
    const el = wallEl;
    const cards = placed;
    if (!el || !cards.length || downloading) return;
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

      const accent = getComputedStyle(el).getPropertyValue("--accent").trim() || "#214247";
      const ink = getComputedStyle(document.documentElement).getPropertyValue("--ink").trim() || "#1a1f1c";
      ctx.fillStyle = "#eef2ef";
      ctx.fillRect(0, 0, W, H);

      const wash = ctx.createRadialGradient(W * 0.5, H * 0.45, 0, W * 0.5, H * 0.45, Math.max(W, H) * 0.45);
      wash.addColorStop(0, hexToRgba(accent, 0.1));
      wash.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = wash;
      ctx.fillRect(0, 0, W, H);

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
      const drawOrder = [...cards].sort((a, b) => a.z - b.z);

      for (const p of drawOrder) {
        const cx = (p.x / 100) * W;
        const cy = (p.y / 100) * H;
        const pw = remToPx(p.w, rootPx);
        const ph = remToPx(p.h, rootPx);
        const rot = (p.rot * Math.PI) / 180;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(rot);

        ctx.fillStyle = "rgba(0,0,0,0.12)";
        ctx.fillRect(-pw / 2 + 2, -ph / 2 + 4, pw, ph);

        ctx.fillStyle = "#fbfaf7";
        ctx.strokeStyle = hexToRgba(ink, 0.1);
        ctx.lineWidth = 1;
        ctx.fillRect(-pw / 2, -ph / 2, pw, ph);
        ctx.strokeRect(-pw / 2, -ph / 2, pw, ph);

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

        const pad = remToPx(0.35, rootPx);
        const faceX = -pw / 2 + pad;
        const faceY = -ph / 2 + pad;
        const faceW = pw - pad * 2;
        const nameBlock = remToPx(0.35, rootPx) + remToPx(0.62 + p.weight * 0.45, rootPx) * 1.15 + remToPx(0.1, rootPx);
        const faceH = Math.max(8, ph - pad - remToPx(0.45, rootPx) - nameBlock);

        const photoUrl = photos[p.label];
        const photoImg = photoUrl ? await loadImage(photoUrl) : null;
        const photoOk = photoImg && photoImg.naturalWidth > 0 && photoImg.naturalHeight > 0;

        if (photoOk) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(faceX, faceY, faceW, faceH);
          ctx.clip();
          const ir = photoImg.naturalWidth / photoImg.naturalHeight;
          const fr = faceW / faceH;
          let dw = faceW;
          let dh = faceH;
          let dx = faceX;
          let dy = faceY;
          if (ir > fr) {
            dh = faceH;
            dw = faceH * ir;
            dx = faceX + (faceW - dw) / 2;
          } else {
            dw = faceW;
            dh = faceW / ir;
            dy = faceY + (faceH - dh) / 2;
          }
          ctx.drawImage(photoImg, dx, dy, dw, dh);
          ctx.restore();
          ctx.strokeStyle = hexToRgba(ink, 0.08);
          ctx.strokeRect(faceX, faceY, faceW, faceH);
        } else {
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
          ctx.fillRect(faceX, faceY, faceW, faceH);
          ctx.strokeStyle = hexToRgba(ink, 0.08);
          ctx.strokeRect(faceX, faceY, faceW, faceH);

          const ini = initial(p.label);
          ctx.fillStyle = mixHex("#ffffff", accent, 0.55);
          ctx.font = `500 ${pw * 0.28}px Fraunces, Georgia, serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(ini, 0, faceY + faceH / 2);
        }

        const nameSize = remToPx(0.62 + p.weight * 0.45, rootPx);
        ctx.fillStyle = ink;
        ctx.font = `500 ${nameSize}px Fraunces, Georgia, serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        const nameY = faceY + faceH + remToPx(0.35, rootPx);
        let name = p.label;
        while (ctx.measureText(name).width > faceW && name.length > 1) {
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
    return `rgb(${Math.round(ar * t + br * (1 - t))},${Math.round(ag * t + bg * (1 - t))},${Math.round(ab * t + bb * (1 - t))})`;
  }
</script>

<section class="people-panel">
  <div class="panel-head">
    <h2>Your stars</h2>
    <div class="actions">
      <div class="density-ctrl" title="Card size — changes how stars are arranged">
        <span class="density-label">Size</span>
        <button type="button" class="btn" onclick={() => adjustDensity(-5)} disabled={densityPct <= MIN_DENSITY} aria-label="Smaller cards">−</button>
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
        <button type="button" class="btn" onclick={() => adjustDensity(5)} disabled={densityPct >= MAX_DENSITY} aria-label="Larger cards">+</button>
      </div>
      <div class="density-ctrl" title="Wall width">
        <span class="density-label">Width</span>
        <input
          class="density-range"
          type="range"
          min={MIN_WIDTH_PCT}
          max={MAX_WIDTH_PCT}
          step="5"
          value={wallWidthPct}
          oninput={(e) => setWallWidth(Number((e.currentTarget as HTMLInputElement).value))}
          aria-label="Stars canvas width"
        />
        <span class="density-value">{wallWidthPct}%</span>
      </div>
      <div class="density-ctrl" title="Wall height">
        <span class="density-label">Height</span>
        <input
          class="density-range short"
          type="range"
          min={MIN_HEIGHT_REM}
          max={MAX_HEIGHT_REM}
          step="1"
          value={wallHeightRem}
          oninput={(e) => setWallHeight(Number((e.currentTarget as HTMLInputElement).value))}
          aria-label="Stars canvas height"
        />
        <span class="density-value">{wallHeightRem}rem</span>
      </div>
      <DropdownMenu bind:open={peopleMenuOpen}>
        <DropdownMenuTrigger class="btn people-menu-trigger" aria-label="Show people filters">
          <span class="people-menu-icon" aria-hidden="true">👥</span>
          <span class="people-menu-text">People</span>
          {#if rearranging}
            <span class="people-menu-status">Rearranging…</span>
          {/if}
          {#if hiddenCount}
            <span class="people-menu-badge">{hiddenCount}</span>
          {/if}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="people-menu-content">
          <div class="people-menu-head">
            <span>People on board</span>
            <span>{peopleList.length}</span>
          </div>
          <div class="people-menu-list">
            {#each peopleList as person}
              {@const visible = !hiddenLabels.has(person.label)}
              <label class="people-menu-item">
                <input type="checkbox" checked={visible} onchange={() => toggleHide(person.label)} />
                <span class="people-menu-name">{person.label}</span>
                <span class="people-menu-count">{person.count}</span>
              </label>
            {/each}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
      <button type="button" class="btn primary" onclick={download} disabled={!placed.length || downloading}>
        {downloading ? "Preparing…" : "Download"}
      </button>
    </div>
  </div>

  <div class="wall" bind:this={wallEl} style={`width: ${wallWidthPct}%; height: ${wallHeightRem}rem;`} aria-label="Your stars as memory cards">
    {#if rearranging}
      <div class="wall-loader" aria-live="polite">Rearranging…</div>
    {/if}
    {#each placed as p, i}
      <article
        class="polaroid"
        style={`--x: ${p.x}%; --y: ${p.y}%; --rot: ${p.rot}deg; --w: ${p.w}rem; --h: ${p.h}rem; --wt: ${p.weight}; --d: ${p.delay}s; --i: ${i}; --z: ${p.z}`}
      >
        <div class="tape" aria-hidden="true"></div>
        <div class="frame">
          <button
            type="button"
            class="face"
            aria-label={photos[p.label] ? `Replace photo for ${p.label}` : `Add photo for ${p.label}`}
            onclick={() => openPhotoPicker(p.label)}
          >
            {#if photos[p.label]}
              <img class="face-photo" src={photos[p.label]} alt="" />
            {:else}
              <span class="initial">{initial(p.label)}</span>
            {/if}
          </button>
          <p class="name">{p.label}</p>
        </div>
      </article>
    {/each}
  </div>

  <input bind:this={fileInputEl} type="file" accept="image/*" class="sr-only" onchange={onFileChosen} />
</section>

{#if cropOpen && cropSrc}
  <PhotoCropModal open={cropOpen} src={cropSrc} personLabel={cropLabel} aspectRatio={faceAspect} onconfirm={onCropConfirm} oncancel={closeCrop} />
{/if}

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

  .density-range.short {
    width: 5rem;
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

  .people-menu-trigger {
    gap: 0.45rem;
  }

  .people-menu-icon {
    font-size: 1rem;
    line-height: 1;
  }

  .people-menu-text {
    font-size: 0.82rem;
  }

  .people-menu-badge {
    min-width: 1.15rem;
    padding: 0.05rem 0.28rem;
    border-radius: 999px;
    background: color-mix(in srgb, var(--accent) 16%, white);
    color: var(--accent);
    font-size: 0.72rem;
    font-variant-numeric: tabular-nums;
  }

  .people-menu-status {
    font-size: 0.72rem;
    color: var(--accent);
    white-space: nowrap;
  }

  .people-menu-content {
    width: min(18rem, calc(100vw - 2rem));
    padding: 0.4rem;
  }

  .people-menu-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.25rem 0.35rem 0.45rem;
    font-size: 0.76rem;
    color: color-mix(in srgb, var(--ink) 60%, transparent);
  }

  .people-menu-list {
    max-height: 16rem;
    overflow: auto;
  }

  .people-menu-item {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 0.55rem;
    padding: 0.4rem 0.45rem;
    border-radius: 0.45rem;
    cursor: pointer;
  }

  .people-menu-item:hover {
    background: color-mix(in srgb, var(--accent) 6%, white);
  }

  .people-menu-item input {
    accent-color: var(--accent);
  }

  .people-menu-name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.84rem;
  }

  .people-menu-count {
    font-size: 0.76rem;
    font-variant-numeric: tabular-nums;
    color: color-mix(in srgb, var(--ink) 45%, transparent);
  }

  .wall {
    position: relative;
    max-width: 100%;
    margin-inline: auto;
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

  .wall-loader {
    position: absolute;
    top: 0.7rem;
    right: 0.7rem;
    z-index: 10;
    padding: 0.3rem 0.55rem;
    border-radius: 999px;
    background: color-mix(in srgb, white 88%, var(--accent) 12%);
    border: 1px solid color-mix(in srgb, var(--accent) 18%, transparent);
    color: var(--accent);
    font-size: 0.74rem;
    font-family: var(--sans);
    box-shadow: 0 4px 10px color-mix(in srgb, var(--ink) 10%, transparent);
  }

  .polaroid {
    position: absolute;
    left: var(--x);
    top: var(--y);
    z-index: var(--z);
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
    padding: 0;
    border: 1px solid color-mix(in srgb, var(--ink) 8%, transparent);
    background: radial-gradient(
      circle at 40% 35%,
      color-mix(in srgb, var(--accent) calc(18% + var(--wt) * 28%), #dfe8e3),
      color-mix(in srgb, var(--ink) 8%, #c5d0cb)
    );
    cursor: pointer;
    overflow: hidden;
  }

  .face:hover {
    outline: 2px solid color-mix(in srgb, var(--accent) 45%, transparent);
    outline-offset: -2px;
  }

  .face-photo {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
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

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  @media (max-width: 520px) {
    .density-range {
      width: 4.5rem;
    }
  }
</style>
