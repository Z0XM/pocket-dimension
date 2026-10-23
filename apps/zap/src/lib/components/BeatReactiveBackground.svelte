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

  /** Expanding radial wavefront spawned from screen center. */
  type RadialWave = {
    r: number;
    speed: number;
    strength: number;
    width: number;
    life: number;
  };

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

    const spacing = mobile ? 28 : 18;
    const baseRadius = mobile ? 1.35 : 1.55;
    const maxWaves = mobile ? 5 : 8;

    let w = 0;
    let h = 0;
    let cols = 0;
    let rows = 0;
    let cx = 0;
    let cy = 0;
    let maxRadius = 1;
    let raf = 0;
    let lastTs = 0;
    let settle = 0;
    let frameSkip = 0;
    let beatCooldown = 0;
    let energyCooldown = 0;

    /** Ambient carrier — slow continuous radial breath from center. */
    let ambientR = 0;
    let ambientSpeed = 55;

    const waves: RadialWave[] = [];

    /** Smoothed analyser channels (cuts jitter). */
    let sBass = 0;
    let sMid = 0;
    let sHigh = 0;
    let sBeat = 0;
    let sRms = 0;

    let xs: Float32Array = new Float32Array(0);
    let ys: Float32Array = new Float32Array(0);
    /** Distance from viewport center for each lattice point. */
    let dist: Float32Array = new Float32Array(0);
    /** Unit radial vectors for soft outward displacement. */
    let ux: Float32Array = new Float32Array(0);
    let uy: Float32Array = new Float32Array(0);

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
      const originX = (w - (cols - 1) * spacing) * 0.5;
      const originY = (h - (rows - 1) * spacing) * 0.5;
      cx = w * 0.5;
      cy = h * 0.5;
      maxRadius = Math.hypot(cx, cy) + spacing * 2;
      const n = cols * rows;
      xs = new Float32Array(n);
      ys = new Float32Array(n);
      dist = new Float32Array(n);
      ux = new Float32Array(n);
      uy = new Float32Array(n);
      let k = 0;
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const x = originX + i * spacing;
          const y = originY + j * spacing;
          const dx = x - cx;
          const dy = y - cy;
          const d = Math.hypot(dx, dy) || 1;
          xs[k] = x;
          ys[k] = y;
          dist[k] = d;
          ux[k] = dx / d;
          uy[k] = dy / d;
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

    function spawnWave(strength: number, energy: PlaybackEnergy) {
      if (reduced) return;
      const band = 0.45 * energy.bass + 0.3 * energy.rms + 0.15 * energy.mid + 0.1 * energy.high;
      waves.push({
        r: 0,
        // Calm travel — stronger hits move a bit faster but stay smooth.
        speed: 48 + band * 55 + strength * 28,
        strength: Math.min(1.35, 0.4 + strength * 0.85 + band * 0.35),
        // Wide soft envelope = smooth ring through the lattice.
        width: 36 + energy.bass * 48 + energy.mid * 18,
        life: 1,
      });
      while (waves.length > maxWaves) waves.shift();
    }

    function ringField(d: number, ringR: number, width: number, strength: number, life: number) {
      const delta = d - ringR;
      const w2 = width * width;
      if (delta * delta > w2 * 9) return 0;
      return Math.exp((-delta * delta) / (2 * w2)) * strength * life;
    }

    function draw(ts: number) {
      const playing = isPlaying();
      const dt = Math.min(0.05, (ts - (lastTs || ts)) / 1000);
      lastTs = ts;

      settle += ((playing ? 1 : 0) - settle) * Math.min(1, dt * (playing ? 2.4 : 1.6));
      if (settle < 0.01 && !playing) {
        waves.length = 0;
        ctx!.clearRect(0, 0, w, h);
        return;
      }

      const e = energyFrame(ts);

      // Smooth analyser → calm lattice response.
      const smoothRate = Math.min(1, dt * 3.2);
      sBass += (e.bass - sBass) * smoothRate;
      sMid += (e.mid - sMid) * smoothRate;
      sHigh += (e.high - sHigh) * smoothRate;
      sBeat += (e.beat - sBeat) * Math.min(1, dt * 5);
      sRms += (e.rms - sRms) * smoothRate;

      beatCooldown = Math.max(0, beatCooldown - dt);
      energyCooldown = Math.max(0, energyCooldown - dt);

      if (playing && !reduced) {
        // Beat / kick → new radial wavefront from center (overlaps allowed).
        if (sBeat > 0.3 && e.beat > 0.28 && beatCooldown <= 0) {
          spawnWave(0.55 + e.beat * 0.9 + e.bass * 0.35, e);
          beatCooldown = 0.09;
        } else if (sRms > 0.55 && e.rms > 0.5 && energyCooldown <= 0 && beatCooldown <= 0) {
          // Sustained high energy also radiates outward.
          spawnWave(0.35 + e.rms * 0.55 + e.mid * 0.25, e);
          energyCooldown = 0.28;
        }

        // Ambient carrier drifts slowly from center → edge, then restarts.
        ambientSpeed = 42 + sBass * 28 + sRms * 18;
        ambientR += ambientSpeed * dt;
        if (ambientR > maxRadius + 80) ambientR = 0;
      }

      for (let i = waves.length - 1; i >= 0; i--) {
        const wv = waves[i]!;
        wv.r += wv.speed * dt;
        // Fade as the ring expands past the viewport.
        wv.life -= dt * (0.12 + (wv.r / maxRadius) * 0.18);
        if (wv.life <= 0 || wv.r > maxRadius + wv.width * 3) {
          waves.splice(i, 1);
        }
      }

      ctx!.clearRect(0, 0, w, h);

      const n = xs.length;
      const restGlow = 0.2 * settle;
      const ambientStrength = reduced ? 0 : (0.18 + sBass * 0.22 + sRms * 0.12) * settle;
      const ambientWidth = 52 + sBass * 36;
      const displaceScale = spacing * (0.22 + sRms * 0.28);

      for (let k = 0; k < n; k++) {
        const d = dist[k]!;
        let field = ringField(d, ambientR, ambientWidth, ambientStrength, 1);

        for (let wi = 0; wi < waves.length; wi++) {
          const wv = waves[wi]!;
          field += ringField(d, wv.r, wv.width, wv.strength, wv.life);
        }

        // Soft high-band shimmer near the wavefronts only (no lattice jitter).
        field += field * sHigh * 0.12;

        const excite = Math.max(0, Math.min(1.4, 0.28 + field));
        const push = field * displaceScale;
        const x = xs[k]! + ux[k]! * push;
        const y = ys[k]! + uy[k]! * push;
        const r = baseRadius * (0.72 + excite * 0.85);
        const alpha = Math.min(0.9, (restGlow + excite * 0.58) * settle);

        const t = Math.max(0, Math.min(1, excite * 0.9));
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
  Full-viewport particle lattice. Soft radial wavefronts expand from center;
  beats spawn overlapping rings. Strength/extent follow analyser energy.
-->
<canvas
  bind:this={canvasEl}
  class="zap-beat-bg pointer-events-none fixed inset-0 z-[1] h-[100dvh] w-screen"
  aria-hidden="true"
  data-analyser={usingAnalyser ? "live" : "fallback"}
></canvas>
