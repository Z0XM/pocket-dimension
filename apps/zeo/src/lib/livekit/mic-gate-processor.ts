import { Track, type AudioProcessorOptions, type TrackProcessor } from "livekit-client";
import { createMicGateController, type MicGateController } from "./mic-gate";

export type MicGateProcessor = TrackProcessor<Track.Kind.Audio, AudioProcessorOptions> & {
  setVolume: (volume: number) => void;
  setCutoff: (cutoff: number) => void;
};

export function createMicGateProcessor(initial?: { volume?: number; cutoff?: number }): MicGateProcessor {
  let controller: MicGateController | null = null;
  let processedTrack: MediaStreamTrack | undefined;

  const processor: MicGateProcessor = {
    name: "zeo-mic-gate",
    processedTrack,
    setVolume(volume) {
      controller?.setVolume(volume);
    },
    setCutoff(cutoff) {
      controller?.setCutoff(cutoff);
    },
    async init(opts) {
      if (opts.audioContext.state === "suspended") {
        await opts.audioContext.resume();
      }

      controller = createMicGateController(opts.audioContext);
      if (initial?.volume !== undefined) {
        controller.setVolume(initial.volume);
      }
      if (initial?.cutoff !== undefined) {
        controller.setCutoff(initial.cutoff);
      }
      controller.connectSource(opts.track);

      // Let the audio graph produce at least one frame before WebRTC reads the processed track.
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

      processedTrack = controller.getOutputStream().getAudioTracks()[0];
      if (processedTrack) {
        processedTrack.enabled = true;
      }
      processor.processedTrack = processedTrack;
    },
    async restart(opts) {
      await processor.destroy();
      await processor.init(opts);
    },
    async destroy() {
      controller?.destroy();
      controller = null;
      processedTrack = undefined;
      processor.processedTrack = undefined;
    },
  };

  return processor;
}
