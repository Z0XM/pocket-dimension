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

  volumeGain.gain.value = volume;
  gateGain.gain.value = 1;

  function disconnectSource() {
    source?.disconnect();
    source = null;
    gateOpen = true;
    gateGain.gain.value = 1;
  }

  function updateGate() {
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
    gateFrame = requestAnimationFrame(updateGate);
  }

  function startGateLoop() {
    cancelAnimationFrame(gateFrame);
    gateFrame = requestAnimationFrame(updateGate);
  }

  function stopGateLoop() {
    cancelAnimationFrame(gateFrame);
    gateFrame = 0;
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

      source = audioContext.createMediaStreamSource(new MediaStream([track]));
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
      stopGateLoop();
      disconnectSource();
      analyser.disconnect();
      gateGain.disconnect();
      volumeGain.disconnect();
    },
  };
}
