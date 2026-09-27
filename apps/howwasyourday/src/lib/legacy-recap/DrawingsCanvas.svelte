<script lang="ts">
  import type { DayEntry } from "./types";
  import { onMount } from "svelte";

  type Props = {
    drawings: DayEntry[];
    /** Used in the download filename (slug or display name). */
    exportName?: string;
  };

  let { drawings, exportName = "canvas" }: Props = $props();

  let wrapEl = $state<HTMLDivElement | null>(null);
  let canvasEl = $state<HTMLCanvasElement | null>(null);
  let status = $state<"loading" | "ready" | "error">("loading");
  let isFullscreen = $state(false);
  let drawCount = $state(0);
  let zoomPct = $state(100);
  let isPanning = $state(false);
  let downloading = $state(false);
  /** Drawings per shelf row — adjustable in fullscreen. */
  let cols = $state(6);
  let minCols = 1;
  let maxCols = 24;
  let toolbarVisible = $state(true);
  let showToolbarPeek = $state(false);

  const PREVIEW_MAX_H = 420;
  const PREVIEW_COUNT = 15;
  const PREVIEW_COLS = 5;
  const GAP = 14;
  const WORLD_PAD = 48;
  const BG = "#ffffff";
  const STAGE_BG = "#0c0e0d";
  const MIN_ZOOM = 0.05;
  const MAX_ZOOM = 8;

  type Laid = { img: HTMLImageElement; x: number; y: number; w: number; h: number };
  type Baked = { canvas: HTMLCanvasElement; w: number; h: number };

  let images: HTMLImageElement[] = [];
  /** Full collage for fullscreen + download. */
  let fullWorld: Baked | null = null;
  /** Inline peek: first few drawings only. */
  let previewWorld: Baked | null = null;

  /** Camera: world → screen. screen = world * scale + (tx, ty) */
  let scale = 1;
  let tx = 0;
  let ty = 0;

  let pointers = new Map<number, { x: number; y: number }>();
  let panLast: { x: number; y: number } | null = null;
  let pinchStart: { dist: number; scale: number; cx: number; cy: number } | null = null;
  let colsDebounce: ReturnType<typeof setTimeout> | null = null;

  function activeWorld(): Baked | null {
    return isFullscreen ? fullWorld : previewWorld;
  }

  onMount(() => {
    const onFs = () => {
      const next = !!document.fullscreenElement;
      isFullscreen = next;
      if (!next) {
        toolbarVisible = true;
        showToolbarPeek = false;
      }
      requestAnimationFrame(() => {
        if (next) fitToView({ animate: false });
        else fitPreview();
      });
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (!document.fullscreenElement) return;
      // Explicit exit so Escape always leaves expanded view, even with chrome hidden.
      void document.exitFullscreen().catch(() => {});
    };
    document.addEventListener("fullscreenchange", onFs);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("fullscreenchange", onFs);
      document.removeEventListener("keydown", onKey);
    };
  });

  $effect(() => {
    const el = wrapEl;
    const fs = isFullscreen;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      if (fs) paint();
      else fitPreview();
    });
    ro.observe(el);
    return () => ro.disconnect();
  });

  $effect(() => {
    const canvas = canvasEl;
    if (!canvas) return;
    const wheel = (e: WheelEvent) => onWheel(e);
    canvas.addEventListener("wheel", wheel, { passive: false });
    return () => canvas.removeEventListener("wheel", wheel);
  });

  $effect(() => {
    drawings;
    void loadAndBuild();
  });

  async function loadAndBuild() {
    const srcs = drawings.map((d) => d.drawing_src).filter(Boolean) as string[];
    drawCount = srcs.length;
    fullWorld = null;
    previewWorld = null;
    if (!srcs.length) {
      status = "ready";
      return;
    }
    status = "loading";
    try {
      images = await Promise.all(srcs.map(loadImage));
      minCols = 1;
      maxCols = Math.max(1, Math.min(24, images.length));
      cols = Math.max(minCols, Math.min(maxCols, Math.round(Math.sqrt(images.length * 1.15))));

      const previewImgs = images.slice(0, Math.min(PREVIEW_COUNT, images.length));
      const previewCols = Math.min(PREVIEW_COLS, previewImgs.length);
      previewWorld = bakeCollage(previewImgs, previewCols, { maxSide: 4096 });
      fullWorld = bakeCollage(images, cols, { maxSide: 8192 });

      status = "ready";
      if (isFullscreen) fitToView({ animate: false });
      else fitPreview();
    } catch (err) {
      console.error("[canvas collage]", err);
      status = "error";
    }
  }

  function rebuildWorld(opts?: { fit?: boolean }) {
    if (!images.length) return;
    fullWorld = bakeCollage(images, cols, { maxSide: 8192 });
    if (opts?.fit === false) {
      paint();
      return;
    }
    if (isFullscreen) fitToView({ animate: false });
    else fitPreview();
  }

  function adjustCols(delta: number) {
    const next = Math.max(minCols, Math.min(maxCols, cols + delta));
    if (next === cols) return;
    cols = next;
    if (colsDebounce) {
      clearTimeout(colsDebounce);
      colsDebounce = null;
    }
    rebuildWorld({ fit: true });
  }

  function setCols(value: number, opts?: { immediate?: boolean }) {
    const next = Math.max(minCols, Math.min(maxCols, Math.round(value)));
    cols = next;
    if (colsDebounce) clearTimeout(colsDebounce);
    if (opts?.immediate) {
      colsDebounce = null;
      rebuildWorld({ fit: true });
      return;
    }
    colsDebounce = setTimeout(() => {
      colsDebounce = null;
      rebuildWorld({ fit: true });
    }, 100);
  }

  function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load ${src}`));
      img.src = src;
    });
  }

  function hash(n: number): number {
    let h = (n * 2654435761) >>> 0;
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return h >>> 0;
  }

  /** Pack drawings onto a white world canvas. */
  function bakeCollage(imgs: HTMLImageElement[], columnCount: number, opts?: { maxSide?: number; nativeSize?: boolean }): Baked | null {
    const n = imgs.length;
    if (!n) return null;
    const maxSide = opts?.maxSide ?? 8192;
    const nativeSize = opts?.nativeSize ?? false;

    const sizes = imgs.map((img, i) => {
      let w = img.naturalWidth || img.width || 1;
      let h = img.naturalHeight || img.height || 1;
      if (!nativeSize) {
        const j = 0.88 + ((hash(i) % 100) / 100) * 0.28;
        w = Math.max(1, Math.round(w * j));
        h = Math.max(1, Math.round(h * j));
      }
      return { w, h };
    });

    const avgW = sizes.reduce((s, it) => s + it.w, 0) / n;
    const colN = Math.max(1, Math.min(n, columnCount));
    const shelfW = colN * avgW + (colN - 1) * GAP;

    const items: Laid[] = [];
    let x = WORLD_PAD;
    let y = WORLD_PAD;
    let rowMaxH = 0;
    let maxR = 0;
    let maxB = 0;

    for (let i = 0; i < n; i++) {
      const { w, h } = sizes[i];

      if (x > WORLD_PAD && x + w > WORLD_PAD + shelfW) {
        x = WORLD_PAD;
        y += rowMaxH + GAP + ((hash(i) % 5) - 2) * 2;
        rowMaxH = 0;
      }

      const jx = nativeSize ? 0 : ((hash(i + 17) % 11) - 5) * 2.2;
      const jy = nativeSize ? 0 : ((hash(i + 91) % 11) - 5) * 2;
      const px = Math.max(WORLD_PAD / 2, x + jx);
      const py = Math.max(WORLD_PAD / 2, y + jy);

      items.push({ img: imgs[i], x: px, y: py, w, h });
      rowMaxH = Math.max(rowMaxH, h + Math.abs(jy));
      x += w + GAP + (nativeSize ? 0 : ((hash(i + 3) % 9) - 4) * 3);
      maxR = Math.max(maxR, px + w);
      maxB = Math.max(maxB, py + h);
    }

    let w = Math.ceil(maxR + WORLD_PAD);
    let h = Math.ceil(maxB + WORLD_PAD);

    let bakeScale = 1;
    if (w > maxSide || h > maxSide) {
      bakeScale = maxSide / Math.max(w, h);
      w = Math.ceil(w * bakeScale);
      h = Math.ceil(h * bakeScale);
    }

    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = bakeScale < 0.999;
    ctx.imageSmoothingQuality = "high";

    for (const it of items) {
      ctx.drawImage(it.img, it.x * bakeScale, it.y * bakeScale, it.w * bakeScale, it.h * bakeScale);
    }

    return { canvas: c, w, h };
  }

  function filenameSafe(raw: string): string {
    return (
      raw
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 48) || "canvas"
    );
  }

  function downloadFilename(): string {
    const who = filenameSafe(exportName);
    return `howwasyourday-2025-${who}-canvas-${drawCount}-drawings.png`;
  }

  function viewportSize(): { w: number; h: number } {
    const wrap = wrapEl;
    if (!wrap) return { w: 280, h: PREVIEW_MAX_H };
    if (isFullscreen) {
      return {
        w: Math.max(320, wrap.clientWidth),
        h: Math.max(320, wrap.clientHeight),
      };
    }
    return {
      w: Math.max(280, wrap.clientWidth || 280),
      h: PREVIEW_MAX_H,
    };
  }

  function fitPreview() {
    const world = previewWorld;
    if (!world) return;
    const { w: vw } = viewportSize();
    // Fill the preview width; only shrink further if height would blow past the cap.
    let fit = vw / world.w;
    if (world.h * fit > PREVIEW_MAX_H) fit = PREVIEW_MAX_H / world.h;
    scale = fit;
    tx = (vw - world.w * scale) / 2;
    ty = 0;
    zoomPct = Math.round(scale * 100);
    paint();
  }

  function fitToView(opts?: { animate?: boolean }) {
    const world = activeWorld();
    if (!world) return;
    const { w: vw, h: vh } = viewportSize();
    const pad = isFullscreen ? 48 : 0;
    const fit = Math.min((vw - pad) / world.w, (vh - pad) / world.h);
    scale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, fit));
    tx = (vw - world.w * scale) / 2;
    ty = (vh - world.h * scale) / 2;
    zoomPct = Math.round(scale * 100);
    void opts;
    paint();
  }

  function zoomAt(screenX: number, screenY: number, nextScale: number) {
    const s = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, nextScale));
    const wx = (screenX - tx) / scale;
    const wy = (screenY - ty) / scale;
    scale = s;
    tx = screenX - wx * scale;
    ty = screenY - wy * scale;
    zoomPct = Math.round(scale * 100);
    paint();
  }

  function zoomBy(factor: number) {
    const { w: vw, h: vh } = viewportSize();
    zoomAt(vw / 2, vh / 2, scale * factor);
  }

  function setZoom100() {
    const { w: vw, h: vh } = viewportSize();
    zoomAt(vw / 2, vh / 2, 1);
  }

  function paint() {
    const canvas = canvasEl;
    const wrap = wrapEl;
    const world = activeWorld();
    if (!canvas || !wrap || !world) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const { w: cssW, h: cssHRaw } = viewportSize();
    const cssH = isFullscreen ? cssHRaw : Math.max(120, Math.min(PREVIEW_MAX_H, Math.ceil(world.h * scale)));

    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = isFullscreen ? STAGE_BG : BG;
    ctx.fillRect(0, 0, cssW, cssH);

    ctx.imageSmoothingEnabled = scale < 1.01;
    ctx.imageSmoothingQuality = "high";

    if (isFullscreen) {
      ctx.save();
      ctx.translate(tx, ty);
      ctx.scale(scale, scale);
      ctx.shadowColor = "rgba(0, 0, 0, 0.55)";
      ctx.shadowBlur = 36 / Math.max(scale, 0.15);
      ctx.shadowOffsetY = 10 / Math.max(scale, 0.15);
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, world.w, world.h);
      ctx.restore();
    }

    ctx.save();
    ctx.translate(tx, ty);
    ctx.scale(scale, scale);
    ctx.drawImage(world.canvas, 0, 0);
    ctx.restore();
  }

  async function toggleFullscreen() {
    if (!wrapEl) return;
    try {
      if (!document.fullscreenElement) {
        await wrapEl.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error("[canvas fullscreen]", err);
    }
  }

  async function download() {
    if (!images.length || downloading) return;
    downloading = true;
    try {
      // Let the loading UI paint before the heavy bake/encode work.
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
      await new Promise<void>((r) => setTimeout(r, 30));

      // Fresh native-resolution bake (not the display-scaled world canvas).
      let baked: Baked | null = null;
      for (const maxSide of [16384, 12288, 8192]) {
        try {
          baked = bakeCollage(images, cols, { maxSide, nativeSize: true });
          if (baked?.canvas.width && baked.canvas.height) break;
        } catch (err) {
          console.warn(`[canvas download] bake failed at ${maxSide}`, err);
          baked = null;
        }
      }
      if (!baked) throw new Error("Could not compose export canvas");

      const blob = await new Promise<Blob | null>((resolve) => baked!.canvas.toBlob((b) => resolve(b), "image/png"));
      if (!blob) throw new Error("Could not encode PNG");

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = downloadFilename();
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("[canvas download]", err);
    } finally {
      downloading = false;
    }
  }

  function onWheel(e: WheelEvent) {
    if (!isFullscreen || !fullWorld) return;
    e.preventDefault();
    const rect = canvasEl?.getBoundingClientRect();
    if (!rect) return;
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const factor = Math.exp(-e.deltaY * 0.0015);
    zoomAt(sx, sy, scale * factor);
  }

  function hideToolbar() {
    toolbarVisible = false;
    showToolbarPeek = false;
  }

  function revealToolbar() {
    toolbarVisible = true;
    showToolbarPeek = false;
  }

  function onStagePointerMove(e: PointerEvent) {
    if (!isFullscreen || toolbarVisible || !wrapEl) return;
    const rect = wrapEl.getBoundingClientRect();
    const fromBottom = rect.bottom - e.clientY;
    showToolbarPeek = fromBottom <= 88;
  }

  function onStagePointerLeave(e: PointerEvent) {
    if (toolbarVisible) return;
    const next = e.relatedTarget as Node | null;
    if (next && wrapEl?.contains(next)) return;
    showToolbarPeek = false;
  }

  function onPointerDown(e: PointerEvent) {
    if (!isFullscreen || !fullWorld) return;
    if ((e.target as HTMLElement)?.closest?.(".fs-bar, .fs-peek")) return;
    canvasEl?.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.size === 1) {
      isPanning = true;
      panLast = { x: e.clientX, y: e.clientY };
      pinchStart = null;
    } else if (pointers.size === 2) {
      isPanning = false;
      panLast = null;
      const pts = [...pointers.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const cx = (pts[0].x + pts[1].x) / 2;
      const cy = (pts[0].y + pts[1].y) / 2;
      pinchStart = { dist, scale, cx, cy };
    }
  }

  function onPointerMove(e: PointerEvent) {
    if (!isFullscreen || !fullWorld) return;
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.size === 2 && pinchStart) {
      const pts = [...pointers.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const rect = canvasEl?.getBoundingClientRect();
      if (!rect || pinchStart.dist < 1) return;
      const cx = (pts[0].x + pts[1].x) / 2 - rect.left;
      const cy = (pts[0].y + pts[1].y) / 2 - rect.top;
      zoomAt(cx, cy, pinchStart.scale * (dist / pinchStart.dist));
      return;
    }

    if (pointers.size === 1 && panLast) {
      const dx = e.clientX - panLast.x;
      const dy = e.clientY - panLast.y;
      tx += dx;
      ty += dy;
      panLast = { x: e.clientX, y: e.clientY };
      paint();
    }
  }

  function onPointerUp(e: PointerEvent) {
    pointers.delete(e.pointerId);
    try {
      canvasEl?.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (pointers.size < 2) pinchStart = null;
    if (pointers.size === 1) {
      const pt = [...pointers.values()][0];
      panLast = { x: pt.x, y: pt.y };
      isPanning = true;
    } else {
      panLast = null;
      isPanning = false;
    }
  }
</script>

<section class="canvas-panel">
  <div class="panel-head">
    <h2>Canvas</h2>
    <div class="actions">
      <button type="button" class="btn" onclick={toggleFullscreen} disabled={status !== "ready"}>
        {isFullscreen ? "Exit full screen" : "Expand to view all drawings"}
      </button>
      <button type="button" class="btn primary" onclick={download} disabled={status !== "ready" || downloading}>
        {downloading ? "Preparing…" : "Download"}
      </button>
    </div>
  </div>

  <div class="stage" class:fullscreen={isFullscreen} bind:this={wrapEl} onpointermove={onStagePointerMove} onpointerleave={onStagePointerLeave}>
    {#if status === "loading"}
      <p class="status">Composing canvas…</p>
    {:else if status === "error"}
      <p class="status err">Couldn’t load some drawings.</p>
    {:else if downloading}
      <p class="status download">Preparing full-resolution download…</p>
    {/if}
    <canvas
      bind:this={canvasEl}
      class:interactive={isFullscreen}
      class:panning={isPanning}
      aria-label="All year drawings composed on one canvas"
      onpointerdown={onPointerDown}
      onpointermove={onPointerMove}
      onpointerup={onPointerUp}
      onpointercancel={onPointerUp}
    ></canvas>
    {#if isFullscreen}
      {#if toolbarVisible}
        <div class="fs-bar">
          <div class="cols-ctrl" title="Drawings per row">
            <span class="cols-label">Cols</span>
            <button type="button" class="btn" onclick={() => adjustCols(-1)} disabled={cols <= minCols} aria-label="Fewer columns">−</button>
            <input
              class="cols-range"
              type="range"
              min={minCols}
              max={maxCols}
              step="1"
              value={cols}
              oninput={(e) => setCols(Number((e.currentTarget as HTMLInputElement).value))}
              onchange={(e) => setCols(Number((e.currentTarget as HTMLInputElement).value), { immediate: true })}
              aria-label="Columns per row"
            />
            <span class="cols-value">{cols}</span>
            <button type="button" class="btn" onclick={() => adjustCols(1)} disabled={cols >= maxCols} aria-label="More columns">+</button>
          </div>
          <span class="sep"></span>
          <button type="button" class="btn" onclick={() => zoomBy(1 / 1.25)} aria-label="Zoom out">−</button>
          <button type="button" class="btn zoom-label" onclick={() => fitToView()}>{zoomPct}%</button>
          <button type="button" class="btn" onclick={() => zoomBy(1.25)} aria-label="Zoom in">+</button>
          <button type="button" class="btn" onclick={() => setZoom100()}>100%</button>
          <button type="button" class="btn" onclick={() => fitToView()}>Fit</button>
          <span class="sep"></span>
          <button type="button" class="btn" onclick={hideToolbar} disabled={downloading}>Hide toolbar</button>
          <button type="button" class="btn primary" onclick={download} disabled={downloading}>
            {downloading ? "Preparing…" : "Download"}
          </button>
          <button type="button" class="btn" onclick={toggleFullscreen} disabled={downloading}>Exit</button>
        </div>
        <p class="hint">Scroll to zoom · drag to pan · Esc to exit</p>
      {:else if showToolbarPeek}
        <button type="button" class="fs-peek btn" onclick={revealToolbar}>Show toolbar</button>
      {/if}
    {/if}
  </div>
</section>

<style>
  .canvas-panel {
    max-width: 48rem;
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
    gap: 0.45rem;
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

  .btn.zoom-label {
    min-width: 3.6rem;
    font-variant-numeric: tabular-nums;
  }

  .cols-ctrl {
    display: flex;
    align-items: center;
    gap: 0.3rem;
  }

  .cols-label {
    padding: 0 0.2rem;
    font-size: 0.78rem;
    color: color-mix(in srgb, var(--ink) 55%, transparent);
    user-select: none;
  }

  .cols-value {
    min-width: 1.6rem;
    text-align: center;
    font-size: 0.85rem;
    font-variant-numeric: tabular-nums;
    color: var(--ink-soft);
    user-select: none;
  }

  .cols-range {
    width: 7rem;
    accent-color: var(--accent);
    cursor: pointer;
  }

  .stage {
    position: relative;
    width: 100%;
    min-height: 160px;
    border-radius: 0.65rem;
    border: 1px solid color-mix(in srgb, var(--ink) 10%, transparent);
    background: #ffffff;
    overflow: hidden;
  }

  canvas {
    display: block;
    width: 100%;
    height: 160px;
    max-height: 420px;
    touch-action: none;
    vertical-align: top;
  }

  canvas.interactive {
    max-height: none;
    height: 100%;
    width: 100%;
    cursor: grab;
  }

  canvas.panning {
    cursor: grabbing;
  }

  .stage:fullscreen,
  .stage.fullscreen {
    border-radius: 0;
    border: none;
    background: #0c0e0d;
    display: block;
    padding: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  .stage:fullscreen canvas,
  .stage.fullscreen canvas {
    max-height: none;
    width: 100%;
    height: 100%;
  }

  .status {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    margin: 0;
    font-size: 0.9rem;
    color: var(--ink-mute);
    background: color-mix(in srgb, #ffffff 80%, transparent);
    pointer-events: none;
    z-index: 2;
  }

  .status.err {
    color: #9b1c1c;
  }

  .status.download {
    color: var(--ink-soft);
  }

  .stage:fullscreen .status.download,
  .stage.fullscreen .status.download {
    color: #e8ece9;
    background: color-mix(in srgb, #0c0e0d 72%, transparent);
  }

  .fs-bar {
    position: absolute;
    bottom: 1rem;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.4rem;
    border-radius: 0.65rem;
    background: color-mix(in srgb, #1a1e1c 72%, transparent);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid color-mix(in srgb, white 14%, transparent);
    z-index: 3;
  }

  .stage:fullscreen .btn,
  .stage.fullscreen .btn {
    background: color-mix(in srgb, #2a302c 80%, transparent);
    border-color: color-mix(in srgb, white 16%, transparent);
    color: #e8ece9;
  }

  .stage:fullscreen .btn.primary,
  .stage.fullscreen .btn.primary {
    border-color: color-mix(in srgb, var(--accent) 55%, transparent);
    background: color-mix(in srgb, var(--accent) 22%, #1a1e1c);
    color: #f2f7f3;
  }

  .stage:fullscreen .cols-label,
  .stage.fullscreen .cols-label,
  .stage:fullscreen .cols-value,
  .stage.fullscreen .cols-value {
    color: color-mix(in srgb, #e8ece9 70%, transparent);
  }

  .sep {
    width: 1px;
    height: 1.25rem;
    margin: 0 0.2rem;
    background: color-mix(in srgb, white 18%, transparent);
  }

  .fs-peek {
    position: absolute;
    bottom: 1rem;
    left: 50%;
    transform: translateX(-50%);
    z-index: 3;
    padding: 0.45rem 0.95rem;
    border-radius: 999px;
    background: color-mix(in srgb, #1a1e1c 78%, transparent);
    border: 1px solid color-mix(in srgb, white 16%, transparent);
    color: #e8ece9;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
  }

  .hint {
    position: absolute;
    top: 1rem;
    left: 50%;
    transform: translateX(-50%);
    margin: 0;
    padding: 0.35rem 0.75rem;
    border-radius: 999px;
    font-size: 0.78rem;
    color: color-mix(in srgb, #e8ece9 60%, transparent);
    background: color-mix(in srgb, #1a1e1c 55%, transparent);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    pointer-events: none;
    z-index: 3;
  }
</style>
