/**
 * Shared catalog playback audio element + optional Web Audio analyser.
 * CatalogQueueDock registers its <audio>; BeatReactiveBackground taps energy.
 */

type Listener = () => void;

let audioEl: HTMLAudioElement | null = null;
const listeners = new Set<Listener>();

let audioCtx: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let sourcedEl: HTMLAudioElement | null = null;
let freqBuf: Uint8Array | null = null;
let timeBuf: Uint8Array | null = null;

export function setPlaybackAudioElement(el: HTMLAudioElement | null) {
  if (audioEl === el) return;
  audioEl = el;
  for (const fn of listeners) fn();
}

export function getPlaybackAudioElement() {
  return audioEl;
}

export function subscribePlaybackAudio(fn: Listener) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function ensureAnalyser(): AnalyserNode | null {
  const el = audioEl;
  if (!el || typeof window === "undefined") return null;

  try {
    if (!audioCtx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return null;
      audioCtx = new Ctx();
    }

    if (sourcedEl !== el) {
      // MediaElementSource can only be created once per element — first registration wins.
      if (sourcedEl) return analyser;
      const source = audioCtx.createMediaElementSource(el);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.82;
      source.connect(analyser);
      analyser.connect(audioCtx.destination);
      sourcedEl = el;
      freqBuf = new Uint8Array(analyser.frequencyBinCount);
      timeBuf = new Uint8Array(analyser.fftSize);
    }

    if (audioCtx.state === "suspended") {
      void audioCtx.resume().catch(() => {});
    }

    return analyser;
  } catch (err) {
    console.warn("[zap playback-audio] analyser unavailable", err);
    return null;
  }
}

/** 0–1 bass / mid / overall energy. `null` fields mean analyser not ready — caller should fake. */
export type PlaybackEnergy = {
  /** Analyser is live (vs time-based fallback). */
  live: boolean;
  bass: number;
  mid: number;
  high: number;
  /** Peak of recent frame — useful for ripple triggers. */
  beat: number;
  rms: number;
};

let prevRms = 0;

export function samplePlaybackEnergy(): PlaybackEnergy | null {
  const node = ensureAnalyser();
  if (!node || !freqBuf || !timeBuf) return null;

  // Cast needed: Bun/lib.dom Uint8Array generics vs AnalyserNode typings.
  node.getByteFrequencyData(freqBuf as unknown as Uint8Array<ArrayBuffer>);
  node.getByteTimeDomainData(timeBuf as unknown as Uint8Array<ArrayBuffer>);

  const n = freqBuf.length;
  const bassEnd = Math.max(2, Math.floor(n * 0.08));
  const midEnd = Math.max(bassEnd + 1, Math.floor(n * 0.35));

  let bass = 0;
  let mid = 0;
  let high = 0;
  for (let i = 0; i < n; i++) {
    const v = freqBuf[i]! / 255;
    if (i < bassEnd) bass += v;
    else if (i < midEnd) mid += v;
    else high += v;
  }
  bass /= bassEnd;
  mid /= Math.max(1, midEnd - bassEnd);
  high /= Math.max(1, n - midEnd);

  let sumSq = 0;
  for (let i = 0; i < timeBuf.length; i++) {
    const centered = (timeBuf[i]! - 128) / 128;
    sumSq += centered * centered;
  }
  const rms = Math.sqrt(sumSq / timeBuf.length);
  const beat = Math.max(0, Math.min(1, (rms - prevRms) * 6 + rms * 0.4));
  prevRms = prevRms * 0.85 + rms * 0.15;

  return {
    live: true,
    bass: clamp01(bass * 1.4),
    mid: clamp01(mid * 1.5),
    high: clamp01(high * 1.6),
    beat: clamp01(beat),
    rms: clamp01(rms * 2.2),
  };
}

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n));
}

/** Soft pulse when analyser isn't available — still looks alive while "playing". */
export function fakePlaybackEnergy(tMs: number): PlaybackEnergy {
  const t = tMs / 1000;
  const kick = Math.pow(Math.max(0, Math.sin(t * Math.PI * 2 * 1.05)), 8);
  const hat = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 7.3));
  return {
    live: false,
    bass: 0.25 + 0.55 * kick,
    mid: 0.2 + 0.35 * (0.5 + 0.5 * Math.sin(t * 2.7 + 1)),
    high: 0.1 + 0.25 * hat,
    beat: kick,
    rms: 0.2 + 0.4 * kick,
  };
}
