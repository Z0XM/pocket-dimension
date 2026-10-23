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

  let { queue }: { queue: CatalogQueueClient } = $props();

  let canvasEl = $state<HTMLCanvasElement | null>(null);
  let usingAnalyser = $state(false);

  type Ripple = { r: number; life: number; max: number };
  type Molecule = { a: number; r: number; vr: number; size: number; life: number };

  function audioActuallyPlaying(): boolean {
    const el = getPlaybackAudioElement();
    if (!el) return false;
    return !el.paused && !el.ended && el.readyState >= 2;
  }

  function isPlaying(): boolean {
    return Boolean(queue.playing) || audioActuallyPlaying();
  }

  onMount(() => {
    const canvas = canvasEl;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const mobile = window.matchMedia("(max-width: 640px)").matches;

    const dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 2);
    let w = 0;
    let h = 0;
    let cx = 0;
    let cy = 0;
    let raf = 0;
    let lastTs = 0;
    let settle = 0;
    let ringPhase = 0;
    let beatCooldown = 0;
    const ripples: Ripple[] = [];
    const molecules: Molecule[] = [];
    const maxMolecules = mobile ? 64 : 120;
    const ringCount = mobile ? 6 : 9;

    function readColors() {
      const cs = getComputedStyle(document.documentElement);
      return {
        signal: cs.getPropertyValue("--signal").trim() || "#ff6b4a",
        ink: cs.getPropertyValue("--foreground").trim() || "#f3efe9",
        mute: cs.getPropertyValue("--border").trim() || "#2a2a2a",
      };
    }
    let colors = readColors();

    function resize() {
      // Full viewport — not the flex parent (which can collapse / clip).
      w = window.innerWidth;
      h = window.innerHeight;
      canvas!.width = Math.max(1, Math.floor(w * dpr));
      canvas!.height = Math.max(1, Math.floor(h * dpr));
      canvas!.style.width = `${w}px`;
      canvas!.style.height = `${h}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx = w * 0.5;
      cy = h * 0.55;
      colors = readColors();
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
      // Analyser missing, silent, or CORS-blocked → visible fake pulse.
      usingAnalyser = false;
      return fakePlaybackEnergy(now);
    }

    function spawnMolecules(mid: number, beat: number) {
      const n = Math.floor(2 + mid * 4 + beat * 5);
      for (let i = 0; i < n && molecules.length < maxMolecules; i++) {
        molecules.push({
          a: Math.random() * Math.PI * 2,
          r: 10 + Math.random() * 28,
          vr: 0.4 + mid * 2 + Math.random(),
          size: 1.2 + Math.random() * 2.2,
          life: 1,
        });
      }
    }

    function draw(ts: number, forceIdle = false) {
      const playing = !forceIdle && isPlaying();
      const dt = forceIdle ? 0.016 : Math.min(0.05, (ts - (lastTs || ts)) / 1000);
      if (!forceIdle) lastTs = ts;

      settle += ((playing ? 1 : 0) - settle) * Math.min(1, dt * (playing ? 4 : 1.8));
      if (settle < 0.008 && !playing) {
        ctx!.clearRect(0, 0, w, h);
        return;
      }

      const e = forceIdle ? fakePlaybackEnergy(0) : energyFrame(ts);
      // Keep a strong base so cymatics stay visible even on quiet tracks / fake idle.
      const intensity = settle * (0.55 + 0.45 * (0.45 * e.bass + 0.3 * e.rms + 0.25 * e.mid));

      beatCooldown = Math.max(0, beatCooldown - dt);
      if (playing && e.beat > 0.28 && beatCooldown <= 0) {
        ripples.push({ r: 16, life: 1, max: Math.min(w, h) * (0.35 + e.bass * 0.25) });
        spawnMolecules(e.mid, e.beat);
        beatCooldown = 0.12;
      } else if (playing && Math.random() < dt * (1.2 + e.mid * 2.5)) {
        spawnMolecules(e.mid * 0.7, 0);
      }

      ringPhase += dt * (0.4 + e.bass * 1.6);

      ctx!.clearRect(0, 0, w, h);

      // Soft water wash (no globalAlpha — per-fill alpha only)
      const wash = ctx!.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.62);
      wash.addColorStop(0, withAlpha(colors.signal, (0.1 + e.bass * 0.1) * settle));
      wash.addColorStop(0.5, withAlpha(colors.ink, 0.04 * settle));
      wash.addColorStop(1, withAlpha(colors.mute, 0));
      ctx!.fillStyle = wash;
      ctx!.fillRect(0, 0, w, h);

      // Cymatics rings — dotted circular lattices (readable first-draft contrast)
      for (let i = 0; i < ringCount; i++) {
        const base = 36 + i * (mobile ? 32 : 42);
        const wobble = Math.sin(ringPhase + i * 0.7) * (6 + e.mid * 14);
        const radius = base + e.bass * (22 + i * 5) + wobble;
        const dots = Math.floor(22 + i * 12 + e.high * 10);
        const alpha = (0.55 - i * 0.04) * (0.65 + intensity * 0.5) * settle;
        ctx!.fillStyle = withAlpha(i % 2 === 0 ? colors.signal : colors.ink, alpha);
        for (let d = 0; d < dots; d++) {
          const a = (d / dots) * Math.PI * 2 + ringPhase * (0.12 + i * 0.02);
          const jitter = (Math.sin(ringPhase * 2 + d + i) * 0.5 + 0.5) * e.high * 4;
          const x = cx + Math.cos(a) * (radius + jitter);
          const y = cy + Math.sin(a) * (radius + jitter) * 0.9;
          const sz = 1.8 + e.rms * 2.2;
          ctx!.beginPath();
          ctx!.arc(x, y, sz, 0, Math.PI * 2);
          ctx!.fill();
        }
      }

      for (let i = ripples.length - 1; i >= 0; i--) {
        const rp = ripples[i]!;
        rp.r += dt * (110 + e.bass * 160);
        rp.life -= dt * 0.5;
        if (rp.life <= 0 || rp.r > rp.max) {
          ripples.splice(i, 1);
          continue;
        }
        ctx!.strokeStyle = withAlpha(colors.signal, 0.35 * rp.life * settle);
        ctx!.lineWidth = 1.25 + (1 - rp.life) * 2;
        ctx!.beginPath();
        ctx!.ellipse(cx, cy, rp.r, rp.r * 0.88, 0, 0, Math.PI * 2);
        ctx!.stroke();
        ctx!.strokeStyle = withAlpha(colors.ink, 0.16 * rp.life * settle);
        ctx!.beginPath();
        ctx!.ellipse(cx, cy, rp.r * 0.7, rp.r * 0.62, 0, 0, Math.PI * 2);
        ctx!.stroke();
      }

      for (let i = molecules.length - 1; i >= 0; i--) {
        const m = molecules[i]!;
        m.r += m.vr * (70 * dt) * (0.7 + e.mid);
        m.life -= dt * (0.16 + e.high * 0.12);
        m.a += dt * 0.18;
        if (m.life <= 0 || m.r > Math.max(w, h) * 0.75) {
          molecules.splice(i, 1);
          continue;
        }
        const x = cx + Math.cos(m.a) * m.r;
        const y = cy + Math.sin(m.a) * m.r * 0.88;
        ctx!.fillStyle = withAlpha(colors.signal, 0.45 * m.life * settle);
        ctx!.beginPath();
        ctx!.arc(x, y, m.size, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.fillStyle = withAlpha(colors.ink, 0.28 * m.life * settle);
        ctx!.beginPath();
        ctx!.arc(x + m.size * 2.4, y - m.size, m.size * 0.5, 0, Math.PI * 2);
        ctx!.fill();
      }
    }

    function frame(ts: number) {
      raf = requestAnimationFrame(frame);
      if (document.hidden) return;
      draw(ts);
    }

    resize();
    window.addEventListener("resize", resize);

    const unsub = subscribePlaybackAudio(() => {
      // Resume AudioContext when the catalog <audio> registers / starts.
      samplePlaybackEnergy();
    });

    if (reduced) {
      // One static frame so the layer is still visible when motion is off.
      settle = 1;
      draw(performance.now(), true);
    } else {
      raf = requestAnimationFrame(frame);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      unsub();
    };
  });

  function withAlpha(color: string, alpha: number) {
    const a = Math.max(0, Math.min(1, alpha));
    if (color.startsWith("#") && (color.length === 7 || color.length === 4)) {
      const hex =
        color.length === 4 ? `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}` : color;
      const r = Number.parseInt(hex.slice(1, 3), 16);
      const g = Number.parseInt(hex.slice(3, 5), 16);
      const b = Number.parseInt(hex.slice(5, 7), 16);
      return `rgba(${r},${g},${b},${a})`;
    }
    // color-mix / hsl tokens — fall back to signal coral
    return `rgba(255,107,74,${a})`;
  }
</script>

<!--
  Fixed full-viewport layer above the page atmosphere, below chrome (z-10+) and floats (z-40).
  Shell body must stay transparent so dots show through between UI.
-->
<canvas
  bind:this={canvasEl}
  class="zap-beat-bg pointer-events-none fixed inset-0 z-[1] h-[100dvh] w-screen"
  aria-hidden="true"
  data-analyser={usingAnalyser ? "live" : "fallback"}
></canvas>
