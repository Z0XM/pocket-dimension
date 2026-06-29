import { createMicGateController, type MicGateController } from "./mic-gate";

export type PreviewAudioMonitor = {
  setVolume: (volume: number) => void;
  setCutoff: (cutoff: number) => void;
  setEnabled: (enabled: boolean) => void;
  setSinkId: (deviceId: string) => Promise<void>;
  setOutputMuted: (muted: boolean) => void;
  updateStream: (stream: MediaStream | null) => void;
  getAudioLevel: () => number;
  destroy: () => void;
};

export function createPreviewAudioMonitor(): PreviewAudioMonitor {
  if (typeof AudioContext === "undefined") {
    throw new Error("Preview audio monitor requires a browser AudioContext");
  }

  const audioContext = new AudioContext();
  const gate = createMicGateController(audioContext);
  const playbackGain = audioContext.createGain();
  const playbackDestination = audioContext.createMediaStreamDestination();

  playbackGain.connect(playbackDestination);

  const audioEl = new Audio();
  audioEl.autoplay = true;
  audioEl.srcObject = playbackDestination.stream;

  let playbackSource: MediaStreamAudioSourceNode | null = null;
  let enabled = false;
  let sinkId = "";
  let outputMuted = false;

  function applyPlaybackGain() {
    playbackGain.gain.value = outputMuted ? 0 : enabled ? 1 : 0;
  }

  function connectPlaybackSource() {
    playbackSource?.disconnect();
    playbackSource = null;

    const processedTrack = gate.getOutputStream().getAudioTracks()[0];
    if (!processedTrack) return;

    playbackSource = audioContext.createMediaStreamSource(new MediaStream([processedTrack]));
    playbackSource.connect(playbackGain);
  }

  async function applySinkId() {
    if (!("setSinkId" in audioEl)) return;

    try {
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      await audioEl.setSinkId(sinkId || "default");

      if (enabled) {
        await audioEl.play();
      }
    } catch {
      // Fall back to the browser default output device.
    }
  }

  function updateStream(stream: MediaStream | null) {
    const audioTrack = stream?.getAudioTracks()[0] ?? null;
    gate.connectSource(audioTrack);
    connectPlaybackSource();
  }

  return {
    setVolume(volume) {
      gate.setVolume(volume);
    },
    setCutoff(cutoff) {
      gate.setCutoff(cutoff);
    },
    setEnabled(nextEnabled) {
      enabled = nextEnabled;
      applyPlaybackGain();
      if (nextEnabled) {
        void applySinkId();
      }
    },
    async setSinkId(deviceId) {
      sinkId = deviceId;
      await applySinkId();
    },
    setOutputMuted(muted) {
      outputMuted = muted;
      applyPlaybackGain();
    },
    updateStream,
    getAudioLevel() {
      if (!enabled) return 0;
      return gate.getInputLevel();
    },
    destroy() {
      playbackSource?.disconnect();
      playbackGain.disconnect();
      gate.destroy();
      audioEl.srcObject = null;
      void audioContext.close();
    },
  };
}
