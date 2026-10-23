<script lang="ts">
  import { onMount } from "svelte";
  import { getCatalogQueue } from "$lib/catalog-queue-client.svelte";
  import { fakePlaybackEnergy, samplePlaybackEnergy, subscribePlaybackAudio, type PlaybackEnergy } from "$lib/playback-audio";

  const queue = getCatalogQueue();

  let canvasEl = $state<HTMLCanvasElement | null>(null);
  let usingAnalyser = $state(false);

  type Ripple = { r: number; life: number; max: number };
  type Molecule = { a: number; r: number; vr: number; size: number; life: number };

  onMount(() => {
    const canvas = canvasEl;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const mobile = window.matchMedia("(max-width: 640px)").matches;
    if (reduced) return;

    const dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 2);
    let w = 0;
    let h = 0;
    let cx = 0;
    let cy = 0;
    let raf = 0;
    let lastTs = 0;
    let settle = 0; // 0 calm → 1 active
    let ringPhase = 0;
    let beatCooldown = 0;
    const ripples: Ripple[] = [];
    const molecules: Molecule[] = [];
    const maxMolecules = mobile ? 48 : 90;
    const ringCount = mobile ? 5 : 7;

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
      const parent = canvas!.parentElement ?? document.documentElement;
      w = parent.clientWidth || window.innerWidth;
      h = parent.clientHeight || window.innerHeight;
      canvas!.width = Math.floor(w * dpr);
      canvas!.height = Math.floor(h * dpr);
      canvas!.style.width = `${w}px`;
      canvas!.style.height = `${h}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx = w * 0.5;
      cy = h * 0.52;
      colors = readColors();
    }

    function energyFrame(now: number): PlaybackEnergy {
      const playing = Boolean(queue?.playing);
      if (!playing) {
        usingAnalyser = false;
        return { live: false, bass: 0, mid: 0, high: 0, beat: 0, rms: 0 };
      }
      const sampled = samplePlaybackEnergy();
      if (sampled) {
        usingAnalyser = true;
        return sampled;
      }
      usingAnalyser = false;
      return fakePlaybackEnergy(now);
    }

    function spawnMolecules(mid: number, beat: number) {
      const n = Math.floor(1 + mid * 3 + beat * 4);
      for (let i = 0; i < n && molecules.length < maxMolecules; i++) {
        molecules.push({
          a: Math.random() * Math.PI * 2,
          r: 8 + Math.random() * 24,
          vr: 0.35 + mid * 1.8 + Math.random() * 0.8,
          size: 0.8 + Math.random() * 1.6,
          life: 1,
        });
      }
    }

    function frame(ts: number) {
      raf = requestAnimationFrame(frame);
      if (document.hidden) return;

      const dt = Math.min(0.05, (ts - (lastTs || ts)) / 1000);
      lastTs = ts;

      const playing = Boolean(queue?.playing);
      settle += ((playing ? 1 : 0) - settle) * Math.min(1, dt * (playing ? 3.2 : 1.6));
      if (settle < 0.01 && !playing) {
        ctx!.clearRect(0, 0, w, h);
        return;
      }

      const e = energyFrame(ts);
      const intensity = settle * (0.35 + 0.65 * (0.4 * e.bass + 0.35 * e.rms + 0.25 * e.mid));

      beatCooldown = Math.max(0, beatCooldown - dt);
      if (playing && e.beat > 0.42 && beatCooldown <= 0) {
        ripples.push({ r: 12, life: 1, max: Math.min(w, h) * (0.28 + e.bass * 0.22) });
        spawnMolecules(e.mid, e.beat);
        beatCooldown = 0.14;
      } else if (playing && Math.random() < dt * (0.8 + e.mid * 2)) {
        spawnMolecules(e.mid * 0.6, 0);
      }

      ringPhase += dt * (0.35 + e.bass * 1.4);

      ctx!.clearRect(0, 0, w, h);
      ctx!.save();
      ctx!.globalAlpha = 0.22 * settle + 0.12 * intensity;

      // Soft water wash under patterns
      const wash = ctx!.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.55);
      wash.addColorStop(0, withAlpha(colors.signal, 0.07 + e.bass * 0.06));
      wash.addColorStop(0.45, withAlpha(colors.ink, 0.03));
      wash.addColorStop(1, withAlpha(colors.mute, 0));
      ctx!.fillStyle = wash;
      ctx!.fillRect(0, 0, w, h);

      // Cymatics rings — dotted circular lattices
      for (let i = 0; i < ringCount; i++) {
        const base = 40 + i * (mobile ? 28 : 36);
        const wobble = Math.sin(ringPhase + i * 0.7) * (4 + e.mid * 10);
        const radius = base + e.bass * (18 + i * 4) + wobble;
        const dots = Math.floor(18 + i * 10 + e.high * 8);
        const alpha = (0.35 - i * 0.035) * (0.5 + intensity);
        ctx!.fillStyle = withAlpha(i % 2 === 0 ? colors.signal : colors.ink, alpha);
        for (let d = 0; d < dots; d++) {
          const a = (d / dots) * Math.PI * 2 + ringPhase * (0.15 + i * 0.02);
          const jitter = (Math.sin(ringPhase * 2 + d + i) * 0.5 + 0.5) * e.high * 3;
          const x = cx + Math.cos(a) * (radius + jitter);
          const y = cy + Math.sin(a) * (radius + jitter) * 0.92;
          const sz = 1.1 + e.rms * 1.4;
          ctx!.beginPath();
          ctx!.arc(x, y, sz, 0, Math.PI * 2);
          ctx!.fill();
        }
      }

      // Water ripples
      for (let i = ripples.length - 1; i >= 0; i--) {
        const rp = ripples[i]!;
        rp.r += dt * (90 + e.bass * 140);
        rp.life -= dt * 0.55;
        if (rp.life <= 0 || rp.r > rp.max) {
          ripples.splice(i, 1);
          continue;
        }
        ctx!.strokeStyle = withAlpha(colors.signal, 0.18 * rp.life * settle);
        ctx!.lineWidth = 1 + (1 - rp.life) * 1.5;
        ctx!.beginPath();
        ctx!.ellipse(cx, cy, rp.r, rp.r * 0.9, 0, 0, Math.PI * 2);
        ctx!.stroke();
        // secondary faint ring
        ctx!.strokeStyle = withAlpha(colors.ink, 0.08 * rp.life * settle);
        ctx!.beginPath();
        ctx!.ellipse(cx, cy, rp.r * 0.72, rp.r * 0.65, 0, 0, Math.PI * 2);
        ctx!.stroke();
      }

      // Molecules dispersing outward
      for (let i = molecules.length - 1; i >= 0; i--) {
        const m = molecules[i]!;
        m.r += m.vr * (60 * dt) * (0.7 + e.mid);
        m.life -= dt * (0.18 + e.high * 0.15);
        m.a += dt * 0.15;
        if (m.life <= 0 || m.r > Math.max(w, h) * 0.7) {
          molecules.splice(i, 1);
          continue;
        }
        const x = cx + Math.cos(m.a) * m.r;
        const y = cy + Math.sin(m.a) * m.r * 0.9;
        ctx!.fillStyle = withAlpha(colors.signal, 0.22 * m.life * settle);
        ctx!.beginPath();
        ctx!.arc(x, y, m.size, 0, Math.PI * 2);
        ctx!.fill();
        // tiny satellite
        ctx!.fillStyle = withAlpha(colors.ink, 0.12 * m.life * settle);
        ctx!.beginPath();
        ctx!.arc(x + m.size * 2.2, y - m.size, m.size * 0.45, 0, Math.PI * 2);
        ctx!.fill();
      }

      ctx!.restore();
    }

    resize();
    const ro = new ResizeObserver(() => resize());
    ro.observe(canvas.parentElement ?? canvas);
    window.addEventListener("resize", resize);

    const unsub = subscribePlaybackAudio(() => {
      // Nudge AudioContext resume when audio element appears / starts.
      samplePlaybackEnergy();
    });

    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("resize", resize);
      unsub();
    };
  });

  function withAlpha(color: string, alpha: number) {
    const a = Math.max(0, Math.min(1, alpha));
    if (color.startsWith("#") && (color.length === 7 || color.length === 4)) {
      const hex =
        color.length === 4
          ? `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`
          : color;
      const r = Number.parseInt(hex.slice(1, 3), 16);
      const g = Number.parseInt(hex.slice(3, 5), 16);
      const b = Number.parseInt(hex.slice(5, 7), 16);
      return `rgba(${r},${g},${b},${a})`;
    }
    return color;
  }
</script>

<canvas
  bind:this={canvasEl}
  class="zap-beat-bg pointer-events-none absolute inset-0 z-0 h-full w-full"
  aria-hidden="true"
  data-analyser={usingAnalyser ? "live" : "fallback"}
></canvas>
