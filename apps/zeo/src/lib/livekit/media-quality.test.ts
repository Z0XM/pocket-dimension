import { describe, expect, it } from "bun:test";
import {
  AUDIO_QUALITY_OPTIONS,
  VIDEO_QUALITY_OPTIONS,
  audioPresetForOption,
  audioQualityLabel,
  roomOptionsForMediaQuality,
  videoPresetForOption,
} from "./media-quality";

describe("media-quality", () => {
  it("exposes concrete video and audio cap ladders", () => {
    expect(VIDEO_QUALITY_OPTIONS).toEqual(["360p", "480p", "720p", "1080p"]);
    expect(AUDIO_QUALITY_OPTIONS).toEqual(["24", "48", "96", "128"]);
  });

  it("maps video options to matching heights", () => {
    expect(videoPresetForOption("360p").height).toBe(360);
    expect(videoPresetForOption("480p").height).toBe(480);
    expect(videoPresetForOption("720p").height).toBe(720);
    expect(videoPresetForOption("1080p").height).toBe(1080);
  });

  it("maps audio options to bitrate caps", () => {
    expect(audioPresetForOption("24").maxBitrate).toBe(24_000);
    expect(audioPresetForOption("48").maxBitrate).toBe(48_000);
    expect(audioPresetForOption("96").maxBitrate).toBe(96_000);
    expect(audioPresetForOption("128").maxBitrate).toBe(128_000);
    expect(audioQualityLabel("48")).toBe("48 kbps");
  });

  it("builds room options with publish defaults for the selected caps", () => {
    const options = roomOptionsForMediaQuality("720p", "48");
    expect(options.videoCaptureDefaults.resolution.height).toBe(720);
    expect(options.publishDefaults.videoEncoding).toEqual(videoPresetForOption("720p").encoding);
    expect(options.publishDefaults.screenShareEncoding).toEqual(videoPresetForOption("720p").encoding);
    expect(options.publishDefaults.audioPreset).toEqual(audioPresetForOption("48"));
  });
});
