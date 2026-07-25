import { AudioPresets, VideoPreset, VideoPresets, type AudioPreset } from "livekit-client";

export const VIDEO_QUALITY_OPTIONS = ["360p", "480p", "720p", "1080p"] as const;
export type VideoQualityOption = (typeof VIDEO_QUALITY_OPTIONS)[number];

export const AUDIO_QUALITY_OPTIONS = ["24", "48", "96", "128"] as const;
export type AudioQualityOption = (typeof AUDIO_QUALITY_OPTIONS)[number];

export const DEFAULT_VIDEO_QUALITY: VideoQualityOption = "720p";
export const DEFAULT_AUDIO_QUALITY: AudioQualityOption = "48";

/** Custom 480p — LiveKit has h360/h540 but not h480. */
const VIDEO_PRESET_480P = new VideoPreset(854, 480, 800_000, 24);

const VIDEO_PRESET_BY_OPTION: Record<VideoQualityOption, VideoPreset> = {
  "360p": VideoPresets.h360,
  "480p": VIDEO_PRESET_480P,
  "720p": VideoPresets.h720,
  "1080p": VideoPresets.h1080,
};

const AUDIO_PRESET_BY_OPTION: Record<AudioQualityOption, AudioPreset> = {
  "24": AudioPresets.speech,
  "48": AudioPresets.music,
  "96": AudioPresets.musicHighQuality,
  "128": AudioPresets.musicHighQualityStereo,
};

export function isVideoQualityOption(value: string | null | undefined): value is VideoQualityOption {
  return VIDEO_QUALITY_OPTIONS.includes(value as VideoQualityOption);
}

export function isAudioQualityOption(value: string | null | undefined): value is AudioQualityOption {
  return AUDIO_QUALITY_OPTIONS.includes(value as AudioQualityOption);
}

export function videoPresetForOption(option: VideoQualityOption): VideoPreset {
  return VIDEO_PRESET_BY_OPTION[option];
}

export function audioPresetForOption(option: AudioQualityOption): AudioPreset {
  return AUDIO_PRESET_BY_OPTION[option];
}

export function audioQualityLabel(option: AudioQualityOption): string {
  return `${option} kbps`;
}

export function roomOptionsForMediaQuality(video: VideoQualityOption, audio: AudioQualityOption) {
  const videoPreset = videoPresetForOption(video);
  const audioPreset = audioPresetForOption(audio);

  return {
    adaptiveStream: true as const,
    dynacast: true as const,
    videoCaptureDefaults: {
      resolution: videoPreset.resolution,
    },
    publishDefaults: {
      videoEncoding: videoPreset.encoding,
      videoSimulcastLayers: simulcastLayersFor(video),
      screenShareEncoding: videoPreset.encoding,
      audioPreset,
    },
  };
}

function simulcastLayersFor(option: VideoQualityOption): VideoPreset[] {
  switch (option) {
    case "1080p":
      return [VideoPresets.h720, VideoPresets.h360];
    case "720p":
      return [VideoPresets.h360, VideoPresets.h180];
    case "480p":
      return [VideoPresets.h180];
    case "360p":
      return [VideoPresets.h180];
  }
}
