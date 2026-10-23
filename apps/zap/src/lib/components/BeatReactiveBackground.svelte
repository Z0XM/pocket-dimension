<script lang="ts">
  import { onMount } from "svelte";
  import type { CatalogQueueClient } from "$lib/catalog-queue-client.svelte";
  import {
    fakePlaybackEnergy,
    fakePlaybackFrequency,
    fakePlaybackWaveform,
    getPlaybackAudioElement,
    samplePlaybackEnergy,
    samplePlaybackFrequency,
    samplePlaybackWaveform,
    subscribePlaybackAudio,
    type PlaybackEnergy,
  } from "$lib/playback-audio";
  import {
    animationsEnabled,
    readAnimationStyle,
    readResponseWindowMs,
    readWaveHistoryMs,
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
    const WAVE_N = mobile ? 256 : 512;
    const FREQ_N = mobile ? 96 : 128;

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
    let style: AnimationStyleId = "radial";

    const waves: RadialWave[] = [];
    const waveBuf = new Float32Array(WAVE_N);
    const freqBuf = new Float32Array(FREQ_N);
    const drawWave = new Float32Array(WAVE_N);
    const drawFreq = new Float32Array(FREQ_N);

    /** Response-window energy samples (peak-biased aggregate). */
    const energyHist: { t: number; e: PlaybackEnergy }[] = [];
    /** Enough frames for up to ~2s response window at ~60fps. */
    const FREQ_HIST_MAX = 128;
    const ENERGY_HIST_MAX = 150;
    const freqHist: { t: number; bins: Float32Array }[] = [];

    /** Scrolling waveform history for scope / mirror (newest on the right; up to 5s). */
    const HISTORY_RATE = 2400;
    const HIST_CAP = Math.ceil((5000 / 1000) * HISTORY_RATE);
    const histBuf = new Float32Array(HIST_CAP);
    let histWrite = 0;
    let histCount = 0;

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

    function fillWaveform(now: number) {
      if (samplePlaybackWaveform(waveBuf)) {
        usingAnalyser = true;
        return;
      }
      usingAnalyser = false;
      fakePlaybackWaveform(now, waveBuf);
    }

    function fillFrequency(now: number) {
      if (samplePlaybackFrequency(freqBuf)) {
        usingAnalyser = true;
        return;
      }
      usingAnalyser = false;
      fakePlaybackFrequency(now, freqBuf);
    }

    function pushEnergyHistory(now: number, e: PlaybackEnergy) {
      energyHist.push({
        t: now,
        e: { live: e.live, bass: e.bass, mid: e.mid, high: e.high, beat: e.beat, rms: e.rms },
      });
      const win = readResponseWindowMs();
      const cutoff = now - Math.max(win, 16);
      while (energyHist.length > 1 && energyHist[0]!.t < cutoff) energyHist.shift();
      while (energyHist.length > ENERGY_HIST_MAX) energyHist.shift();
    }

    /** 55% peak / 45% average over the response window (0 → instant). */
    function aggregateEnergy(now: number, instant: PlaybackEnergy): PlaybackEnergy {
      const win = readResponseWindowMs();
      pushEnergyHistory(now, instant);
      if (win <= 0 || energyHist.length <= 1) return instant;
      const cutoff = now - win;
      let n = 0;
      let bass = 0;
      let mid = 0;
      let high = 0;
      let rms = 0;
      let beat = 0;
      let peakBass = 0;
      let peakMid = 0;
      let peakHigh = 0;
      let peakRms = 0;
      let peakBeat = 0;
      for (const s of energyHist) {
        if (s.t < cutoff) continue;
        n++;
        bass += s.e.bass;
        mid += s.e.mid;
        high += s.e.high;
        rms += s.e.rms;
        beat += s.e.beat;
        peakBass = Math.max(peakBass, s.e.bass);
        peakMid = Math.max(peakMid, s.e.mid);
        peakHigh = Math.max(peakHigh, s.e.high);
        peakRms = Math.max(peakRms, s.e.rms);
        peakBeat = Math.max(peakBeat, s.e.beat);
      }
      if (n === 0) return instant;
      const inv = 1 / n;
      const mix = (avg: number, peak: number) => peak * 0.55 + avg * 0.45;
      return {
        live: instant.live,
        bass: mix(bass * inv, peakBass),
        mid: mix(mid * inv, peakMid),
        high: mix(high * inv, peakHigh),
        rms: mix(rms * inv, peakRms),
        beat: mix(beat * inv, peakBeat),
      };
    }

    function pushFreqHistory(now: number) {
      const bins = Float32Array.from(freqBuf);
      freqHist.push({ t: now, bins });
      while (freqHist.length > FREQ_HIST_MAX) freqHist.shift();
      const win = readResponseWindowMs();
      const cutoff = now - Math.max(win, 16);
      while (freqHist.length > 1 && freqHist[0]!.t < cutoff) freqHist.shift();
    }

    function aggregateFrequency(now: number) {
      pushFreqHistory(now);
      const win = readResponseWindowMs();
      if (win <= 0 || freqHist.length <= 1) {
        drawFreq.set(freqBuf);
        return;
      }
      const cutoff = now - win;
      drawFreq.fill(0);
      let n = 0;
      const peaks = new Float32Array(drawFreq.length);
      for (const s of freqHist) {
        if (s.t < cutoff) continue;
        n++;
        for (let i = 0; i < drawFreq.length; i++) {
          const v = s.bins[i] ?? 0;
          drawFreq[i]! += v;
          peaks[i] = Math.max(peaks[i]!, v);
        }
      }
      if (n === 0) {
        drawFreq.set(freqBuf);
        return;
      }
      const inv = 1 / n;
      for (let i = 0; i < drawFreq.length; i++) {
        drawFreq[i] = peaks[i]! * 0.55 + drawFreq[i]! * inv * 0.45;
      }
    }

    function appendWaveHistory(dt: number, now: number) {
      fillWaveform(now);
      const nPush = Math.max(1, Math.round(dt * HISTORY_RATE));
      for (let i = 0; i < nPush; i++) {
        const src = Math.min(waveBuf.length - 1, Math.floor((i / nPush) * waveBuf.length));
        histBuf[histWrite] = waveBuf[src]!;
        histWrite = (histWrite + 1) % HIST_CAP;
        histCount = Math.min(HIST_CAP, histCount + 1);
      }
    }

    /** Fill `drawWave` oldest→left, newest→right for the selected history window. */
    function buildDrawWave(now: number, dt: number) {
      const histMs = readWaveHistoryMs();
      if (histMs <= 0) {
        fillWaveform(now);
        drawWave.set(waveBuf);
        return;
      }
      appendWaveHistory(dt, now);
      const want = Math.min(histCount, Math.max(8, Math.ceil((histMs / 1000) * HISTORY_RATE)));
      const outN = drawWave.length;
      for (let i = 0; i < outN; i++) {
        const srcOffset = want - 1 - Math.floor((i / Math.max(1, outN - 1)) * (want - 1));
        // histWrite points at next write (= one past newest)
        const idx = (histWrite - 1 - srcOffset + HIST_CAP * 4) % HIST_CAP;
        drawWave[i] = histBuf[idx]!;
      }
    }

    function spawnWave(strength: number, energy: PlaybackEnergy) {
      if (reduced) return;
      const band = 0.45 * energy.bass + 0.3 * energy.rms + 0.15 * energy.mid + 0.1 * energy.high;
      waves.push({
        r: 0,
        // Faster travel + thinner crest (Radial only — spawnWave unused by other styles).
        speed: 110 + band * 95 + strength * 50,
        strength: Math.min(1.35, 0.4 + strength * 0.85 + band * 0.35),
        width: 16 + energy.bass * 22 + energy.mid * 8,
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

    function syncStyle() {
      const next = readAnimationStyle();
      if (next !== style) {
        style = next;
        styleAttr = next;
        waves.length = 0;
        ambientR = 0;
        histCount = 0;
        histWrite = 0;
        energyHist.length = 0;
        freqHist.length = 0;
      }
    }

    function rgba(rgb: { r: number; g: number; b: number }, a: number) {
      return `rgba(${rgb.r},${rgb.g},${rgb.b},${Math.max(0, Math.min(1, a))})`;
    }

    /** Radial lattice — restored to `6ca8f09` (center-out rings, outward lift). */
    function drawRadial(e: PlaybackEnergy, dt: number, playing: boolean) {
      beatCooldown = Math.max(0, beatCooldown - dt);
      energyCooldown = Math.max(0, energyCooldown - dt);

      if (playing && !reduced) {
        // Beat / kick → new radial wavefront from center (overlaps allowed).
        if (sBeat > 0.3 && e.beat > 0.28 && beatCooldown <= 0) {
          spawnWave(0.55 + e.beat * 0.9 + e.bass * 0.35, e);
          beatCooldown = 0.09;
        } else if (sRms > 0.55 && e.rms > 0.5 && energyCooldown <= 0 && beatCooldown <= 0) {
          spawnWave(0.35 + e.rms * 0.55 + e.mid * 0.25, e);
          energyCooldown = 0.28;
        }
        // Ambient carrier from center → edge (kept snappier with beat waves).
        ambientR += (90 + sBass * 50 + sRms * 30) * dt;
        if (ambientR > maxRadius + 80) ambientR = 0;
      }

      for (let i = waves.length - 1; i >= 0; i--) {
        const wv = waves[i]!;
        wv.r += wv.speed * dt;
        wv.life -= dt * (0.12 + (wv.r / maxRadius) * 0.18);
        if (wv.life <= 0 || wv.r > maxRadius + wv.width * 3) waves.splice(i, 1);
      }

      const n = xs.length;
      const restGlow = 0.2 * settle;
      const ambientStrength = reduced ? 0 : (0.18 + sBass * 0.22 + sRms * 0.12) * settle;
      const ambientWidth = 22 + sBass * 16;
      const displaceScale = spacing * (0.22 + sRms * 0.28);

      for (let k = 0; k < n; k++) {
        const d = dist[k]!;
        let field = ringField(d, ambientR, ambientWidth, ambientStrength, 1);
        for (let wi = 0; wi < waves.length; wi++) {
          const wv = waves[wi]!;
          field += ringField(d, wv.r, wv.width, wv.strength, wv.life);
        }
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

    /** ECG / oscilloscope — time-domain trace (live or scrolling history). */
    function drawScope() {
      const midY = h * 0.52;
      const amp = h * (0.16 + sRms * 0.12);
      const pad = Math.min(48, w * 0.06);

      ctx!.strokeStyle = rgba(inkRgb, 0.12 * settle);
      ctx!.lineWidth = 1;
      ctx!.beginPath();
      ctx!.moveTo(pad, midY);
      ctx!.lineTo(w - pad, midY);
      ctx!.stroke();

      ctx!.strokeStyle = rgba(signalRgb, (0.55 + sRms * 0.35) * settle);
      ctx!.lineWidth = mobile ? 1.5 : 2;
      ctx!.lineJoin = "round";
      ctx!.beginPath();
      const n = drawWave.length;
      for (let i = 0; i < n; i++) {
        const x = pad + (i / (n - 1)) * (w - pad * 2);
        const y = midY - drawWave[i]! * amp * (reduced ? 0.35 : 1);
        if (i === 0) ctx!.moveTo(x, y);
        else ctx!.lineTo(x, y);
      }
      ctx!.stroke();

      ctx!.strokeStyle = rgba(signalRgb, 0.18 * settle);
      ctx!.lineWidth = mobile ? 4 : 6;
      ctx!.stroke();
    }

    /** Classic frequency bars — bottom-aligned, signal tint. */
    function drawSpectrum() {
      const barCount = mobile ? 40 : 64;
      const usable = Math.min(barCount, drawFreq.length);
      const gap = 2;
      const padX = Math.min(40, w * 0.05);
      const padY = Math.min(56, h * 0.1);
      const totalGap = gap * (usable - 1);
      const barW = Math.max(2, (w - padX * 2 - totalGap) / usable);
      const maxH = h * (0.38 + sBass * 0.08);

      for (let i = 0; i < usable; i++) {
        const src = Math.min(drawFreq.length - 1, Math.floor((i / usable) * drawFreq.length * 0.9));
        const v = drawFreq[src]! * (reduced ? 0.4 : 1);
        const bh = Math.max(2, v * maxH * settle);
        const x = padX + i * (barW + gap);
        const y = h - padY - bh;
        const t = Math.min(1, v * 1.1);
        const cr = (inkRgb.r + (signalRgb.r - inkRgb.r) * t) | 0;
        const cg = (inkRgb.g + (signalRgb.g - inkRgb.g) * t) | 0;
        const cb = (inkRgb.b + (signalRgb.b - inkRgb.b) * t) | 0;
        ctx!.fillStyle = `rgba(${cr},${cg},${cb},${(0.35 + v * 0.55) * settle})`;
        ctx!.fillRect(x, y, barW, bh);
      }
    }

    /** Circular frequency spectrum around center. */
    function drawRing() {
      const bins = mobile ? 48 : 72;
      const usable = Math.min(bins, drawFreq.length);
      const inner = Math.min(w, h) * 0.14;
      const span = Math.min(w, h) * (0.22 + sRms * 0.06);

      ctx!.strokeStyle = rgba(inkRgb, 0.1 * settle);
      ctx!.lineWidth = 1;
      ctx!.beginPath();
      ctx!.arc(cx, cy, inner, 0, Math.PI * 2);
      ctx!.stroke();

      for (let i = 0; i < usable; i++) {
        const src = Math.min(drawFreq.length - 1, Math.floor((i / usable) * drawFreq.length * 0.85));
        const v = drawFreq[src]! * (reduced ? 0.4 : 1);
        const a0 = (i / usable) * Math.PI * 2 - Math.PI / 2;
        const a1 = ((i + 0.72) / usable) * Math.PI * 2 - Math.PI / 2;
        const r1 = inner + v * span * settle;
        const x0 = cx + Math.cos(a0) * inner;
        const y0 = cy + Math.sin(a0) * inner;
        const x1 = cx + Math.cos(a0) * r1;
        const y1 = cy + Math.sin(a0) * r1;
        const x2 = cx + Math.cos(a1) * r1;
        const y2 = cy + Math.sin(a1) * r1;
        const x3 = cx + Math.cos(a1) * inner;
        const y3 = cy + Math.sin(a1) * inner;
        const t = Math.min(1, v * 1.15);
        const cr = (inkRgb.r + (signalRgb.r - inkRgb.r) * t) | 0;
        const cg = (inkRgb.g + (signalRgb.g - inkRgb.g) * t) | 0;
        const cb = (inkRgb.b + (signalRgb.b - inkRgb.b) * t) | 0;
        ctx!.fillStyle = `rgba(${cr},${cg},${cb},${(0.3 + v * 0.55) * settle})`;
        ctx!.beginPath();
        ctx!.moveTo(x0, y0);
        ctx!.lineTo(x1, y1);
        ctx!.lineTo(x2, y2);
        ctx!.lineTo(x3, y3);
        ctx!.closePath();
        ctx!.fill();
      }
    }

    /** Mirrored time-domain waveform (live or scrolling history). */
    function drawMirror() {
      const midY = h * 0.5;
      const amp = h * (0.2 + sRms * 0.14);
      const pad = Math.min(36, w * 0.05);
      const n = drawWave.length;
      const motion = reduced ? 0.35 : 1;

      ctx!.beginPath();
      for (let i = 0; i < n; i++) {
        const x = pad + (i / (n - 1)) * (w - pad * 2);
        const y = midY - Math.abs(drawWave[i]!) * amp * motion * settle;
        if (i === 0) ctx!.moveTo(x, midY);
        ctx!.lineTo(x, y);
      }
      for (let i = n - 1; i >= 0; i--) {
        const x = pad + (i / (n - 1)) * (w - pad * 2);
        ctx!.lineTo(x, midY);
      }
      ctx!.closePath();
      ctx!.fillStyle = rgba(signalRgb, (0.28 + sRms * 0.25) * settle);
      ctx!.fill();

      ctx!.beginPath();
      for (let i = 0; i < n; i++) {
        const x = pad + (i / (n - 1)) * (w - pad * 2);
        const y = midY + Math.abs(drawWave[i]!) * amp * motion * settle;
        if (i === 0) ctx!.moveTo(x, midY);
        ctx!.lineTo(x, y);
      }
      for (let i = n - 1; i >= 0; i--) {
        const x = pad + (i / (n - 1)) * (w - pad * 2);
        ctx!.lineTo(x, midY);
      }
      ctx!.closePath();
      ctx!.fillStyle = rgba(signalRgb, (0.22 + sRms * 0.2) * settle);
      ctx!.fill();

      ctx!.strokeStyle = rgba(signalRgb, (0.55 + sBeat * 0.25) * settle);
      ctx!.lineWidth = 1.25;
      ctx!.beginPath();
      for (let i = 0; i < n; i++) {
        const x = pad + (i / (n - 1)) * (w - pad * 2);
        const y = midY - Math.abs(drawWave[i]!) * amp * motion * settle;
        if (i === 0) ctx!.moveTo(x, y);
        else ctx!.lineTo(x, y);
      }
      ctx!.stroke();
      ctx!.beginPath();
      for (let i = 0; i < n; i++) {
        const x = pad + (i / (n - 1)) * (w - pad * 2);
        const y = midY + Math.abs(drawWave[i]!) * amp * motion * settle;
        if (i === 0) ctx!.moveTo(x, y);
        else ctx!.lineTo(x, y);
      }
      ctx!.stroke();
    }

    function draw(ts: number) {
      const playing = isPlaying();
      const dt = Math.min(0.05, (ts - (lastTs || ts)) / 1000);
      lastTs = ts;

      syncStyle();

      settle += ((playing ? 1 : 0) - settle) * Math.min(1, dt * (playing ? 2.4 : 1.6));
      if (settle < 0.01 && !playing) {
        waves.length = 0;
        histCount = 0;
        histWrite = 0;
        energyHist.length = 0;
        freqHist.length = 0;
        ctx!.clearRect(0, 0, w, h);
        return;
      }

      const instant = energyFrame(ts);
      const e = aggregateEnergy(ts, instant);
      const smoothRate = Math.min(1, dt * 3.2);
      sBass += (e.bass - sBass) * smoothRate;
      sMid += (e.mid - sMid) * smoothRate;
      sHigh += (e.high - sHigh) * smoothRate;
      sBeat += (e.beat - sBeat) * Math.min(1, dt * 5);
      sRms += (e.rms - sRms) * smoothRate;

      ctx!.clearRect(0, 0, w, h);

      if (style === "radial") {
        drawRadial(e, dt, playing);
      } else if (style === "scope") {
        buildDrawWave(ts, dt);
        drawScope();
      } else if (style === "spectrum") {
        fillFrequency(ts);
        aggregateFrequency(ts);
        drawSpectrum();
      } else if (style === "ring") {
        fillFrequency(ts);
        aggregateFrequency(ts);
        drawRing();
      } else {
        buildDrawWave(ts, dt);
        drawMirror();
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
  Beat-reactive visualizers. Style from Theme → Motion (data-animation-style).
  Radial = lattice splash; others are distinct analyser-driven visualizers.
-->
<canvas
  bind:this={canvasEl}
  class="zap-beat-bg pointer-events-none fixed inset-0 h-[100dvh] w-screen"
  aria-hidden="true"
  data-analyser={usingAnalyser ? "live" : "fallback"}
  data-style={styleAttr}
></canvas>
