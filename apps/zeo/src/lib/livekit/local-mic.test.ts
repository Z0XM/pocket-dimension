import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { Room } from "livekit-client";
import type { MicGateProcessor } from "./mic-gate-processor";

const attachMicGateProcessor = mock(async (_room: unknown, _processor: unknown) => undefined);

mock.module("./room-client", () => ({
  attachMicGateProcessor,
}));

const { disableLocalMicrophone, enableLocalMicrophoneWithGate } = await import("./local-mic");

type FakeRoom = {
  localParticipant: {
    getTrackPublication: () => { track: FakeTrack };
    setMicrophoneEnabled: ReturnType<typeof mock>;
  };
};

type FakeTrack = {
  kind: "audio";
  mediaStreamTrack: {
    kind: "audio";
    enabled: boolean;
    readyState: MediaStreamTrackState;
    stop: () => void;
  };
  stopProcessor: ReturnType<typeof mock>;
  restartTrack: ReturnType<typeof mock>;
};

function createFakeRoom(options?: { readyState?: MediaStreamTrackState; micEnabled?: boolean }) {
  const mediaStreamTrack = {
    kind: "audio" as const,
    enabled: options?.micEnabled ?? true,
    readyState: options?.readyState ?? ("live" as MediaStreamTrackState),
    stop() {},
  };

  const track: FakeTrack = {
    kind: "audio",
    mediaStreamTrack,
    stopProcessor: mock(async () => undefined),
    restartTrack: mock(async () => {
      mediaStreamTrack.readyState = "live";
    }),
  };

  const room: FakeRoom = {
    localParticipant: {
      getTrackPublication: () => ({ track }),
      setMicrophoneEnabled: mock(async (enabled: boolean) => {
        mediaStreamTrack.enabled = enabled;
        if (enabled && mediaStreamTrack.readyState === "ended") {
          mediaStreamTrack.readyState = "live";
        }
        return { track };
      }),
    },
  };

  return { room: room as unknown as Room, fake: room, track, mediaStreamTrack };
}

describe("disableLocalMicrophone", () => {
  beforeEach(() => {
    attachMicGateProcessor.mockClear();
  });

  it("stops the processor before muting the microphone", async () => {
    const { room, fake, track } = createFakeRoom();

    await disableLocalMicrophone(room);

    expect(track.stopProcessor).toHaveBeenCalledTimes(1);
    expect(fake.localParticipant.setMicrophoneEnabled).toHaveBeenCalledWith(false);
  });

  it("still mutes when stopProcessor fails", async () => {
    const { room, fake, track } = createFakeRoom();
    track.stopProcessor.mockImplementation(async () => {
      throw new Error("already stopped");
    });

    await disableLocalMicrophone(room);

    expect(fake.localParticipant.setMicrophoneEnabled).toHaveBeenCalledWith(false);
  });
});

describe("enableLocalMicrophoneWithGate", () => {
  beforeEach(() => {
    attachMicGateProcessor.mockReset();
    attachMicGateProcessor.mockImplementation(async () => undefined);
  });

  it("enables the mic and attaches a fresh gate processor", async () => {
    const { room, fake } = createFakeRoom({ micEnabled: false });
    const created = { name: "fresh-gate" } as unknown as MicGateProcessor;
    const createProcessor = mock(() => created);
    const onGateFallback = mock(() => undefined);

    const attached = await enableLocalMicrophoneWithGate(room, {
      deviceId: "mic-1",
      createProcessor,
      onGateFallback,
    });

    expect(fake.localParticipant.setMicrophoneEnabled).toHaveBeenCalledWith(true, { deviceId: "mic-1" });
    expect(createProcessor).toHaveBeenCalledTimes(1);
    expect(attachMicGateProcessor).toHaveBeenCalledWith(room, created);
    expect(attached).toBe(created);
    expect(onGateFallback).not.toHaveBeenCalled();
  });

  it("restarts an ended capture track before attaching the gate", async () => {
    const { room, fake, track, mediaStreamTrack } = createFakeRoom({
      readyState: "ended",
      micEnabled: false,
    });

    // Keep the track ended through setMicrophoneEnabled so the helper must restart.
    fake.localParticipant.setMicrophoneEnabled.mockImplementation(async (enabled: boolean) => {
      mediaStreamTrack.enabled = enabled;
      return { track };
    });

    const created = { name: "fresh-gate" } as unknown as MicGateProcessor;
    await enableLocalMicrophoneWithGate(room, {
      deviceId: "mic-1",
      createProcessor: () => created,
    });

    expect(track.restartTrack).toHaveBeenCalledWith({ deviceId: "mic-1" });
    expect(mediaStreamTrack.readyState).toBe("live");
    expect(attachMicGateProcessor).toHaveBeenCalledWith(room, created);
  });

  it("falls back to raw mic when the gate cannot attach", async () => {
    const { room, track } = createFakeRoom({ micEnabled: false });
    attachMicGateProcessor.mockImplementation(async () => {
      throw new Error("no audio context");
    });
    const onGateFallback = mock(() => undefined);

    const attached = await enableLocalMicrophoneWithGate(room, {
      createProcessor: () => ({ name: "fresh-gate" }) as unknown as MicGateProcessor,
      onGateFallback,
    });

    expect(attached).toBeNull();
    expect(track.stopProcessor).toHaveBeenCalled();
    expect(onGateFallback).toHaveBeenCalledTimes(1);
  });
});
