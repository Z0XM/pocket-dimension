/**
 * Shared playback audio element(s) + optional Web Audio analyser.
 * CatalogQueueDock and SessionPlayer register their <audio>; BeatReactiveBackground taps energy.
 */

type Listener = () => void;

const registered = new Set<HTMLAudioElement>();
const listeners = new Set<Listener>();

let audioCtx: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
/** One MediaElementSource per element (Web Audio allows only one). */
const mediaSources = new WeakMap<HTMLAudioElement, MediaElementAudioSourceNode>();
let analyserTap: MediaElementAudioSourceNode | null = null;
let freqBuf: Uint8Array | null = null;
let timeBuf: Uint8Array | null = null;

function notify() {
  for (const fn of listeners) fn();
}

/** Prefer an element that is actually outputting audio. */
export function getPlaybackAudioElement(): HTMLAudioElement | null {
  for (const el of registered) {
    if (!el.paused && !el.ended && el.readyState >= 2) return el;
  }
  for (const el of registered) {
    if (el.getAttribute("src") || el.currentSrc) return el;
  }
  return registered.values().next().value ?? null;
}

/**
 * Register a playback <audio> element. Returns cleanup (call on destroy / effect teardown).
 * Multiple sources (catalog queue + session) may be registered; the active one is preferred.
 */
export function registerPlaybackAudio(el: HTMLAudioElement) {
  registered.add(el);
  notify();
  return () => {
    registered.delete(el);
    if (analyserTap && mediaSources.get(el) === analyserTap) {
      try {
        analyserTap.disconnect(analyser!);
      } catch {
        // already disconnected
      }
      analyserTap = null;
    }
    notify();
  };
}

/** @deprecated Prefer registerPlaybackAudio — kept for simple single-element callers. */
export function setPlaybackAudioElement(el: HTMLAudioElement | null) {
  registered.clear();
  if (el) registered.add(el);
  notify();
}

export function subscribePlaybackAudio(fn: Listener) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function ensureAnalyser(): AnalyserNode | null {
  const el = getPlaybackAudioElement();
  if (!el || typeof window === "undefined") return null;

  try {
    if (!audioCtx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return null;
      audioCtx = new Ctx();
    }

    if (!analyser) {
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.82;
      freqBuf = new Uint8Array(analyser.frequencyBinCount);
      timeBuf = new Uint8Array(analyser.fftSize);
    }

    let source = mediaSources.get(el);
    if (!source) {
      source = audioCtx.createMediaElementSource(el);
      mediaSources.set(el, source);
      // Element audio is routed through the graph — keep it audible.
      source.connect(audioCtx.destination);
    }

    if (analyserTap !== source) {
      if (analyserTap && analyser) {
        try {
          analyserTap.disconnect(analyser);
        } catch {
          // ignore
        }
      }
      source.connect(analyser);
      analyserTap = source;
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

/**
 * Soft pulse when analyser isn't available — still looks alive while "playing".
 * Amplitudes stay high enough that cymatics dots remain visible on first draft.
 */
export function fakePlaybackEnergy(tMs: number): PlaybackEnergy {
  const t = tMs / 1000;
  const kick = Math.pow(Math.max(0, Math.sin(t * Math.PI * 2 * 1.05)), 6);
  const hat = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * 7.3));
  return {
    live: false,
    bass: 0.4 + 0.55 * kick,
    mid: 0.35 + 0.4 * (0.5 + 0.5 * Math.sin(t * 2.7 + 1)),
    high: 0.2 + 0.35 * hat,
    beat: Math.max(kick, 0.15 + 0.25 * (0.5 + 0.5 * Math.sin(t * 2.1))),
    rms: 0.35 + 0.45 * kick,
  };
}
