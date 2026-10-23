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
  import {
    animationsEnabled,
    readAnimationStyle,
    type AnimationStyleId,
  } from "$lib/theme-prefs";

  let { queue }: { queue: CatalogQueueClient } = $props();

  let canvasEl = $state<HTMLCanvasElement | null>(null);
  let usingAnalyser = $state(false);
  let styleAttr = $state<AnimationStyleId>("radial");

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
    let ambientR = 0;
    let wavePhase = 0;
    let vortexPhase = 0;
    let style: AnimationStyleId = "radial";

    const waves: RadialWave[] = [];

    let sBass = 0;
    let sMid = 0;
    let sHigh = 0;
    let sBeat = 0;
    let sRms = 0;

    let xs: Float32Array = new Float32Array(0);
    let ys: Float32Array = new Float32Array(0);
    let dist: Float32Array = new Float32Array(0);
    let ux: Float32Array = new Float32Array(0);
    let uy: Float32Array = new Float32Array(0);
    /** Normalized lattice coords 0–1. */
    let nu: Float32Array = new Float32Array(0);
    let nv: Float32Array = new Float32Array(0);
    let colOf: Uint16Array = new Uint16Array(0);
    let rowOf: Uint16Array = new Uint16Array(0);
    /** Stable per-dot noise seeds. */
    let seed: Float32Array = new Float32Array(0);

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
      nu = new Float32Array(n);
      nv = new Float32Array(n);
      colOf = new Uint16Array(n);
      rowOf = new Uint16Array(n);
      seed = new Float32Array(n);
      const invCols = cols > 1 ? 1 / (cols - 1) : 0;
      const invRows = rows > 1 ? 1 / (rows - 1) : 0;
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
          nu[k] = i * invCols;
          nv[k] = j * invRows;
          colOf[k] = i;
          rowOf[k] = j;
          seed[k] = fract(Math.sin(i * 127.1 + j * 311.7) * 43758.5453);
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
        speed: 48 + band * 55 + strength * 28,
        strength: Math.min(1.35, 0.4 + strength * 0.85 + band * 0.35),
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

    /** Column band energy 0–1 for bars style (bass → left, high → right). */
    function columnEnergy(col: number): number {
      const t = cols > 1 ? col / (cols - 1) : 0;
      if (t < 0.33) {
        const u = t / 0.33;
        return sBass * (1 - u) + sMid * u;
      }
      if (t < 0.66) {
        const u = (t - 0.33) / 0.33;
        return sMid * (1 - u) + sRms * u;
      }
      const u = (t - 0.66) / 0.34;
      return sRms * (1 - u) + sHigh * u;
    }

    function syncStyle() {
      const next = readAnimationStyle();
      if (next !== style) {
        style = next;
        styleAttr = next;
        waves.length = 0;
        ambientR = 0;
      }
    }

    function draw(ts: number) {
      const playing = isPlaying();
      const dt = Math.min(0.05, (ts - (lastTs || ts)) / 1000);
      lastTs = ts;

      syncStyle();

      settle += ((playing ? 1 : 0) - settle) * Math.min(1, dt * (playing ? 2.4 : 1.6));
      if (settle < 0.01 && !playing) {
        waves.length = 0;
        ctx!.clearRect(0, 0, w, h);
        return;
      }

      const e = energyFrame(ts);
      const smoothRate = Math.min(1, dt * 3.2);
      sBass += (e.bass - sBass) * smoothRate;
      sMid += (e.mid - sMid) * smoothRate;
      sHigh += (e.high - sHigh) * smoothRate;
      sBeat += (e.beat - sBeat) * Math.min(1, dt * 5);
      sRms += (e.rms - sRms) * smoothRate;

      beatCooldown = Math.max(0, beatCooldown - dt);
      energyCooldown = Math.max(0, energyCooldown - dt);

      if (playing && !reduced) {
        if (style === "radial") {
          if (sBeat > 0.3 && e.beat > 0.28 && beatCooldown <= 0) {
            spawnWave(0.55 + e.beat * 0.9 + e.bass * 0.35, e);
            beatCooldown = 0.09;
          } else if (sRms > 0.55 && e.rms > 0.5 && energyCooldown <= 0 && beatCooldown <= 0) {
            spawnWave(0.35 + e.rms * 0.55 + e.mid * 0.25, e);
            energyCooldown = 0.28;
          }
          ambientR += (42 + sBass * 28 + sRms * 18) * dt;
          if (ambientR > maxRadius + 80) ambientR = 0;
        } else if (style === "wave") {
          wavePhase += dt * (0.55 + sBass * 0.35 + sRms * 0.25);
        } else if (style === "vortex") {
          vortexPhase += dt * (0.4 + sMid * 0.55 + sBeat * 0.35);
        } else if (style === "bloom" && sBeat > 0.32 && e.beat > 0.3 && beatCooldown <= 0) {
          // Bloom uses ambientR as pulse radius kick.
          ambientR = Math.min(maxRadius * 0.55, 40 + e.bass * 120 + e.beat * 80);
          beatCooldown = 0.14;
        } else if (style === "noise" && sBeat > 0.35 && beatCooldown <= 0) {
          beatCooldown = 0.12;
        }
      }

      if (style === "radial") {
        for (let i = waves.length - 1; i >= 0; i--) {
          const wv = waves[i]!;
          wv.r += wv.speed * dt;
          wv.life -= dt * (0.12 + (wv.r / maxRadius) * 0.18);
          if (wv.life <= 0 || wv.r > maxRadius + wv.width * 3) waves.splice(i, 1);
        }
      } else if (style === "bloom" && playing && !reduced) {
        // Soft decay of bloom radius toward a resting breath size.
        const rest = 60 + sBass * 90 + sRms * 50;
        ambientR += (rest - ambientR) * Math.min(1, dt * 1.6);
      }

      ctx!.clearRect(0, 0, w, h);

      const n = xs.length;
      const restGlow = 0.2 * settle;
      const motion = reduced ? 0 : 1;

      for (let k = 0; k < n; k++) {
        let field = 0;
        let ox = 0;
        let oy = 0;
        const d = dist[k]!;
        const u = nu[k]!;
        const v = nv[k]!;

        if (style === "radial") {
          const ambientStrength = motion * (0.18 + sBass * 0.22 + sRms * 0.12) * settle;
          field = ringField(d, ambientR, 52 + sBass * 36, ambientStrength, 1);
          for (let wi = 0; wi < waves.length; wi++) {
            const wv = waves[wi]!;
            // Bias the envelope slightly ahead of the crest so the leading edge
            // reads as the splash pressing into the surface first.
            const lead = ringField(d, wv.r + wv.width * 0.35, wv.width * 0.85, wv.strength * 0.7, wv.life);
            field += ringField(d, wv.r, wv.width, wv.strength, wv.life) + lead;
          }
          field += field * sHigh * 0.12;
          // Water-hit: crest dips down (+Y) into the surface, not toward the viewer.
          const dip = field * spacing * (0.55 + sRms * 0.4);
          ox = ux[k]! * field * spacing * 0.06;
          oy = dip;
        } else if (style === "wave") {
          // Soft horizontal + gentle radial blend — flowing, not beat-spiky.
          const horiz = Math.sin(u * Math.PI * 2.2 - wavePhase) * (0.35 + sMid * 0.45);
          const softRadial = Math.sin(d * 0.012 - wavePhase * 0.65) * (0.2 + sBass * 0.4);
          field = motion * (0.25 + horiz * 0.55 + softRadial * 0.45 + sRms * 0.2) * settle;
          oy = field * spacing * 0.45;
          ox = softRadial * spacing * 0.12;
        } else if (style === "noise") {
          const t = ts * 0.001;
          const n1 = fract(seed[k]! + t * (0.35 + sHigh * 0.8) + sBass * 0.1);
          const n2 = fract(seed[k]! * 1.7 + t * 0.55);
          const grain = (n1 - 0.5) * 2;
          const energy = 0.25 + sRms * 0.55 + sHigh * 0.35 + sBeat * 0.25;
          field = motion * Math.max(0, energy * (0.35 + Math.abs(grain) * 0.9)) * settle;
          ox = grain * spacing * 0.35 * energy * motion;
          oy = (n2 - 0.5) * spacing * 0.35 * energy * motion;
        } else if (style === "bars") {
          const height = columnEnergy(colOf[k]!) * (0.55 + sBeat * 0.2);
          const fromBottom = 1 - v;
          const lit = fromBottom <= height + 0.04 ? 1 : Math.max(0, 1 - (fromBottom - height) * 8);
          field = motion * lit * (0.35 + height * 0.75) * settle;
          oy = -field * spacing * 0.15;
        } else if (style === "bloom") {
          const sigma = Math.max(28, ambientR * (0.55 + sBass * 0.25));
          const glow = Math.exp((-d * d) / (2 * sigma * sigma));
          field = motion * glow * (0.35 + sBass * 0.55 + sRms * 0.35 + sBeat * 0.25) * settle;
          const push = field * spacing * 0.4;
          ox = ux[k]! * push;
          oy = uy[k]! * push;
        } else {
          // vortex
          const ang = Math.atan2(uy[k]!, ux[k]!);
          const arms = 3 + Math.floor(sMid * 2);
          const twist = Math.sin(ang * arms - vortexPhase + d * 0.018);
          field = motion * (0.28 + twist * (0.35 + sRms * 0.4) + sBass * 0.2) * settle;
          // Tangential displacement (perp to radial).
          const tx = -uy[k]!;
          const ty = ux[k]!;
          const push = twist * spacing * (0.3 + sMid * 0.35) * motion;
          ox = tx * push + ux[k]! * sBass * spacing * 0.08;
          oy = ty * push + uy[k]! * sBass * spacing * 0.08;
        }

        const excite = Math.max(0, Math.min(1.4, 0.28 + field));
        const x = xs[k]! + ox;
        const y = ys[k]! + oy;
        // Radial splash: impact shrinks dots (into the surface); other styles still bloom up.
        const sizeMul =
          style === "radial" ? Math.max(0.35, 1.05 - excite * 0.55) : 0.72 + excite * 0.85;
        const r = baseRadius * sizeMul;
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

    style = readAnimationStyle();
    styleAttr = style;
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

  function fract(n: number) {
    return n - Math.floor(n);
  }

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
  Full-viewport particle lattice. Style from Theme → Motion (data-animation-style).
-->
<canvas
  bind:this={canvasEl}
  class="zap-beat-bg pointer-events-none fixed inset-0 z-[1] h-[100dvh] w-screen"
  aria-hidden="true"
  data-analyser={usingAnalyser ? "live" : "fallback"}
  data-style={styleAttr}
></canvas>
