<script lang="ts">
  import { onMount } from "svelte";
  import type { CatalogQueueClient } from "$lib/catalog-queue-client.svelte";
  import {
    fakePlaybackEnergy,
    getPlaybackAudioElement,
    samplePlaybackEnergy,
    subscribePlaybackAudio,
    type PlaybackEnergy,
  } from "$lib/playback-audio";
  import { animationsEnabled } from "$lib/theme-prefs";

  let { queue }: { queue: CatalogQueueClient } = $props();

  let canvasEl = $state<HTMLCanvasElement | null>(null);
  let usingAnalyser = $state(false);

  function audioActuallyPlaying(): boolean {
    const el = getPlaybackAudioElement();
    if (!el) return false;
    return !el.paused && !el.ended && el.readyState >= 2;
  }

  function isPlaying(): boolean {
    if (!animationsEnabled()) return false;
    return Boolean(queue.playing) || audioActuallyPlaying();
  }

  onMount(() => {
    const canvas = canvasEl;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const mobile = window.matchMedia("(max-width: 640px)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 2);

    /** Rest lattice spacing — denser on desktop, throttled on mobile. */
    const spacing = mobile ? 28 : 18;
    const baseRadius = mobile ? 1.35 : 1.55;

    let w = 0;
    let h = 0;
    let cols = 0;
    let rows = 0;
    let originX = 0;
    let originY = 0;
    let raf = 0;
    let lastTs = 0;
    let settle = 0;
    let phase = 0;
    let frameSkip = 0;

    /** Precomputed rest positions (flat: i, j → x, y). */
    let xs: Float32Array = new Float32Array(0);
    let ys: Float32Array = new Float32Array(0);

    function readColors() {
      const cs = getComputedStyle(document.documentElement);
      return {
        signal: cs.getPropertyValue("--signal").trim() || "#ff6b4a",
        ink: cs.getPropertyValue("--foreground").trim() || "#f3efe9",
      };
    }
    let colors = readColors();
    let signalRgb = parseRgb(colors.signal) ?? { r: 255, g: 107, b: 74 };
    let inkRgb = parseRgb(colors.ink) ?? { r: 243, g: 239, b: 233 };

    function rebuildLattice() {
      cols = Math.max(2, Math.floor(w / spacing) + 1);
      rows = Math.max(2, Math.floor(h / spacing) + 1);
      originX = (w - (cols - 1) * spacing) * 0.5;
      originY = (h - (rows - 1) * spacing) * 0.5;
      const n = cols * rows;
      xs = new Float32Array(n);
      ys = new Float32Array(n);
      let k = 0;
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          xs[k] = originX + i * spacing;
          ys[k] = originY + j * spacing;
          k++;
        }
      }
    }

    function resize() {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas!.width = Math.max(1, Math.floor(w * dpr));
      canvas!.height = Math.max(1, Math.floor(h * dpr));
      canvas!.style.width = `${w}px`;
      canvas!.style.height = `${h}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      colors = readColors();
      signalRgb = parseRgb(colors.signal) ?? signalRgb;
      inkRgb = parseRgb(colors.ink) ?? inkRgb;
      rebuildLattice();
    }

    function energyFrame(now: number): PlaybackEnergy {
      if (!isPlaying()) {
        usingAnalyser = false;
        return { live: false, bass: 0, mid: 0, high: 0, beat: 0, rms: 0 };
      }
      const sampled = samplePlaybackEnergy();
      if (sampled && (sampled.rms > 0.02 || sampled.bass > 0.05)) {
        usingAnalyser = true;
        return sampled;
      }
      usingAnalyser = false;
      return fakePlaybackEnergy(now);
    }

    function draw(ts: number) {
      const playing = isPlaying();
      const dt = Math.min(0.05, (ts - (lastTs || ts)) / 1000);
      lastTs = ts;

      settle += ((playing ? 1 : 0) - settle) * Math.min(1, dt * (playing ? 3.5 : 2));
      if (settle < 0.01 && !playing) {
        ctx!.clearRect(0, 0, w, h);
        return;
      }

      const e = energyFrame(ts);
      // Advance wave phase; bass slows the carrier, high adds shimmer speed.
      if (!reduced && playing) {
        phase += dt * (1.1 + e.bass * 1.4 + e.mid * 0.6);
      }

      ctx!.clearRect(0, 0, w, h);

      const n = xs.length;
      const invCols = cols > 1 ? 1 / (cols - 1) : 0;
      const invRows = rows > 1 ? 1 / (rows - 1) : 0;

      // Wavelengths in lattice units — bass travels long, high is fine.
      const kBass = Math.PI * 1.15;
      const kMid = Math.PI * 2.4;
      const kHigh = Math.PI * 4.6;
      const ampBass = e.bass * (reduced ? 0 : 1);
      const ampMid = e.mid * (reduced ? 0 : 1);
      const ampHigh = e.high * (reduced ? 0 : 1);
      const beatKick = e.beat * (reduced ? 0 : 1);
      const restGlow = 0.22 * settle; // quiet medium at rest / low energy
      const maxDisplace = spacing * (0.35 + e.rms * 0.45);

      for (let k = 0; k < n; k++) {
        const i = k % cols;
        const j = (k / cols) | 0;
        const u = i * invCols;
        const v = j * invRows;

        // Traveling wavefronts through the lattice (frequency → band).
        const bassWave = Math.sin(u * kBass - phase * 1.05 + v * 0.35) * ampBass;
        const midWave = Math.sin((u + v) * kMid - phase * 1.55) * ampMid;
        const highWave = Math.sin(v * kHigh - phase * 2.35 + u * 1.1) * ampHigh;
        // Soft radial beat pulse from center on kicks.
        const dx = u - 0.5;
        const dy = v - 0.5;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const beatWave = Math.sin(dist * Math.PI * 3.2 - phase * 2.8) * beatKick * 0.85;

        const field = bassWave * 0.55 + midWave * 0.3 + highWave * 0.2 + beatWave * 0.45;
        const excite = Math.max(0, Math.min(1.35, 0.35 + field + e.rms * 0.25));

        const x = xs[k]! + field * maxDisplace * 0.35;
        const y = ys[k]! + field * maxDisplace;
        const r = baseRadius * (0.75 + excite * 0.9);
        const alpha = Math.min(0.92, (restGlow + excite * 0.55) * settle);

        // Blend signal (peaks) ↔ ink (rest) by excitation.
        const t = Math.max(0, Math.min(1, excite * 0.85));
        const cr = (inkRgb.r + (signalRgb.r - inkRgb.r) * t) | 0;
        const cg = (inkRgb.g + (signalRgb.g - inkRgb.g) * t) | 0;
        const cb = (inkRgb.b + (signalRgb.b - inkRgb.b) * t) | 0;
        ctx!.fillStyle = `rgba(${cr},${cg},${cb},${alpha})`;
        ctx!.beginPath();
        ctx!.arc(x, y, r, 0, Math.PI * 2);
        ctx!.fill();
      }
    }

    function frame(ts: number) {
      raf = requestAnimationFrame(frame);
      if (document.hidden) return;
      // Mobile: draw every other frame to keep CPU/GPU calm.
      if (mobile) {
        frameSkip ^= 1;
        if (frameSkip === 0) return;
      }
      draw(ts);
    }

    resize();
    window.addEventListener("resize", resize);

    const unsub = subscribePlaybackAudio(() => {
      samplePlaybackEnergy();
    });

    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      unsub();
    };
  });

  function parseRgb(color: string): { r: number; g: number; b: number } | null {
    if (color.startsWith("#") && (color.length === 7 || color.length === 4)) {
      const hex =
        color.length === 4 ? `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}` : color;
      return {
        r: Number.parseInt(hex.slice(1, 3), 16),
        g: Number.parseInt(hex.slice(3, 5), 16),
        b: Number.parseInt(hex.slice(5, 7), 16),
      };
    }
    return null;
  }
</script>

<!--
  Full-viewport particle lattice under chrome. Waves flow through the grid from
  analyser bands (bass/mid/high) — not concentric cymatics rings.
-->
<canvas
  bind:this={canvasEl}
  class="zap-beat-bg pointer-events-none fixed inset-0 z-[1] h-[100dvh] w-screen"
  aria-hidden="true"
  data-analyser={usingAnalyser ? "live" : "fallback"}
></canvas>
