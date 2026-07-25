import { describe, expect, it } from "bun:test";
import { createMicGateProcessor } from "./mic-gate-processor";

if (typeof globalThis.requestAnimationFrame !== "function") {
  globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) =>
    setTimeout(() => cb(Date.now()), 0) as unknown as number);
}
if (typeof globalThis.cancelAnimationFrame !== "function") {
  globalThis.cancelAnimationFrame = ((id: number) => clearTimeout(id));
}
if (typeof globalThis.MediaStream !== "function") {
  globalThis.MediaStream = class MediaStream {
    constructor(public tracks: MediaStreamTrack[] = []) {}
    getAudioTracks() {
      return this.tracks.filter((track) => track.kind === "audio");
    }
  } as unknown as typeof MediaStream;
}

function fakeAudioContext(): AudioContext {
  const destinationTrack = {
    kind: "audio",
    enabled: true,
    readyState: "live",
    stop() {},
  };

  const destination = {
    stream: {
      getAudioTracks: () => [destinationTrack],
    },
    disconnect() {},
  };

  const node = () => ({
    connect() {
      return this;
    },
    disconnect() {},
    gain: { value: 1 },
    fftSize: 256,
    smoothingTimeConstant: 0.65,
    getByteTimeDomainData(samples: Uint8Array) {
      samples.fill(128);
    },
  });

  return {
    state: "running",
    resume: async () => undefined,
    createAnalyser: () => node(),
    createGain: () => node(),
    createMediaStreamDestination: () => destination,
    createMediaStreamSource: () => node(),
  } as unknown as AudioContext;
}

function fakeMicTrack(): MediaStreamTrack {
  return {
    kind: "audio",
    enabled: true,
    readyState: "live",
    stop() {},
  } as unknown as MediaStreamTrack;
}

describe("createMicGateProcessor", () => {
  it("restarts without audioContext in opts by reusing the context from init", async () => {
    const processor = createMicGateProcessor({ volume: 0.5, cutoff: 0.1 });
    const audioContext = fakeAudioContext();

    await processor.init({
      kind: "audio" as never,
      track: fakeMicTrack(),
      audioContext,
    });

    expect(processor.processedTrack?.readyState).toBe("live");

    await processor.restart({
      kind: "audio" as never,
      track: fakeMicTrack(),
      // LiveKit omits audioContext on track reacquire — this must still work.
    } as never);

    expect(processor.processedTrack?.readyState).toBe("live");
    expect(processor.processedTrack?.enabled).toBe(true);

    await processor.destroy();
    expect(processor.processedTrack).toBeUndefined();
  });

  it("fails init when no audio context has ever been provided", async () => {
    const processor = createMicGateProcessor();

    await expect(
      processor.init({
        kind: "audio" as never,
        track: fakeMicTrack(),
        audioContext: undefined as never,
      })
    ).rejects.toThrow(/audio context/i);
  });
});
