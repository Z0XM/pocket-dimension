import { describe, expect, it } from "bun:test";

/**
 * Behavioral contract tests for share toggle helpers.
 * These mirror the mute/unmute + teardown rules without LiveKit room mocks.
 */

type FakePublication = {
  track: { sid: string } | null;
  isMuted: boolean;
};

function isActive(publication: FakePublication | undefined) {
  return Boolean(publication?.track && !publication.isMuted);
}

function shouldStopShare(video: FakePublication | undefined, audio: FakePublication | undefined) {
  return !isActive(video) && !isActive(audio);
}

describe("screen share toggle teardown contract", () => {
  it("keeps capture when video is muted but audio remains unmuted", () => {
    const video: FakePublication = { track: { sid: "v" }, isMuted: true };
    const audio: FakePublication = { track: { sid: "a" }, isMuted: false };
    expect(shouldStopShare(video, audio)).toBe(false);
  });

  it("stops capture when audio is muted after video was already muted", () => {
    const video: FakePublication = { track: { sid: "v" }, isMuted: true };
    const audio: FakePublication = { track: { sid: "a" }, isMuted: true };
    expect(shouldStopShare(video, audio)).toBe(true);
  });

  it("allows re-enable when audio publication still exists but is muted", () => {
    const audio: FakePublication = { track: { sid: "a" }, isMuted: true };
    expect(Boolean(audio.track)).toBe(true);
    expect(isActive(audio)).toBe(false);
  });

  it("stops capture when video is turned off with no audio publication", () => {
    const video: FakePublication = { track: { sid: "v" }, isMuted: true };
    expect(shouldStopShare(video, undefined)).toBe(true);
  });
});
