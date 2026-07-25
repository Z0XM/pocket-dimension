export function measureAudioLevel(analyser: AnalyserNode, samples: Uint8Array<ArrayBuffer>): number {
  analyser.getByteTimeDomainData(samples);

  let sumSquares = 0;
  for (const sample of samples) {
    const normalized = (sample - 128) / 128;
    sumSquares += normalized * normalized;
  }

  return Math.min(1, Math.sqrt(sumSquares / samples.length) * 5);
}

export type MicGateController = {
  setVolume: (volume: number) => void;
  setCutoff: (cutoff: number) => void;
  connectSource: (track: MediaStreamTrack | null) => void;
  getOutputStream: () => MediaStream;
  getInputLevel: () => number;
  destroy: () => void;
};

function scheduleFrame(callback: () => void): number {
  if (typeof globalThis.requestAnimationFrame === "function") {
    return globalThis.requestAnimationFrame(callback);
  }
  return globalThis.setTimeout(callback, 16) as unknown as number;
}

function cancelFrame(id: number) {
  if (typeof globalThis.cancelAnimationFrame === "function") {
    globalThis.cancelAnimationFrame(id);
    return;
  }
  globalThis.clearTimeout(id);
}

export function createMicGateController(audioContext: AudioContext): MicGateController {
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.65;

  const gateGain = audioContext.createGain();
  const volumeGain = audioContext.createGain();
  const destination = audioContext.createMediaStreamDestination();

  analyser.connect(gateGain);
  gateGain.connect(volumeGain);
  volumeGain.connect(destination);

  const levelSamples = new Uint8Array(analyser.fftSize) as Uint8Array<ArrayBuffer>;

  let source: MediaStreamAudioSourceNode | null = null;
  let volume = 0.75;
  let cutoff = 0.05;
  let gateOpen = true;
  let gateFrame = 0;
  let gateGeneration = 0;
  let alive = true;

  volumeGain.gain.value = volume;
  gateGain.gain.value = 1;

  function disconnectSource() {
    source?.disconnect();
    source = null;
    gateOpen = true;
    gateGain.gain.value = 1;
  }

  function updateGate(generation: number) {
    if (!alive || generation !== gateGeneration) {
      return;
    }

    if (!source) {
      gateGain.gain.value = 0;
      return;
    }

    const level = measureAudioLevel(analyser, levelSamples);
    const openThreshold = cutoff;
    const closeThreshold = cutoff * 0.85;

    if (gateOpen) {
      if (level < closeThreshold) {
        gateOpen = false;
      }
    } else if (level >= openThreshold) {
      gateOpen = true;
    }

    gateGain.gain.value = gateOpen ? 1 : 0;
    gateFrame = scheduleFrame(() => updateGate(generation));
  }

  function startGateLoop() {
    cancelFrame(gateFrame);
    gateGeneration += 1;
    const generation = gateGeneration;
    gateFrame = scheduleFrame(() => updateGate(generation));
  }

  function stopGateLoop() {
    cancelFrame(gateFrame);
    gateFrame = 0;
    gateGeneration += 1;
  }

  return {
    setVolume(nextVolume) {
      volume = Math.min(1, Math.max(0, nextVolume));
      volumeGain.gain.value = volume;
    },
    setCutoff(nextCutoff) {
      cutoff = Math.min(1, Math.max(0, nextCutoff));
    },
    connectSource(track) {
      disconnectSource();
      stopGateLoop();

      if (!track) return;

      source = audioContext.createMediaStreamSource(new globalThis.MediaStream([track]));
      source.connect(analyser);
      startGateLoop();
    },
    getOutputStream() {
      return destination.stream;
    },
    getInputLevel() {
      if (!source) return 0;
      return measureAudioLevel(analyser, levelSamples);
    },
    destroy() {
      alive = false;
      stopGateLoop();
      disconnectSource();
      analyser.disconnect();
      gateGain.disconnect();
      volumeGain.disconnect();
    },
  };
}
