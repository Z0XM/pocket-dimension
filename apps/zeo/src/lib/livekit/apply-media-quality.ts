import {
  Track,
  type LocalAudioTrack,
  type LocalParticipant,
  type LocalTrackPublication,
  type LocalVideoTrack,
  type Room,
} from "livekit-client";
import {
  audioPresetForOption,
  roomOptionsForMediaQuality,
  videoPresetForOption,
  videoSimulcastLayersFor,
  type AudioQualityOption,
  type VideoQualityOption,
} from "./media-quality";

function syncRoomOptions(room: Room, video: VideoQualityOption, audio: AudioQualityOption) {
  const options = roomOptionsForMediaQuality(video, audio);
  room.options.videoCaptureDefaults = {
    ...room.options.videoCaptureDefaults,
    ...options.videoCaptureDefaults,
  };
  room.options.publishDefaults = {
    ...room.options.publishDefaults,
    ...options.publishDefaults,
  };
  return options;
}

async function republishCamera(
  local: LocalParticipant,
  video: VideoQualityOption,
  deviceId: string | undefined
) {
  const publication = local.getTrackPublication(Track.Source.Camera) as LocalTrackPublication | undefined;
  const track = publication?.videoTrack as LocalVideoTrack | undefined;
  if (!publication || !track || !local.isCameraEnabled) return;

  const preset = videoPresetForOption(video);
  const wasMuted = publication.isMuted;

  await local.unpublishTrack(track, false);
  await track.restartTrack({
    deviceId,
    resolution: preset.resolution,
  });
  await local.publishTrack(track, {
    source: Track.Source.Camera,
    videoEncoding: preset.encoding,
    videoSimulcastLayers: videoSimulcastLayersFor(video),
    simulcast: true,
  });

  if (wasMuted) {
    await track.mute();
  }
}

async function republishScreenShareVideo(local: LocalParticipant, video: VideoQualityOption) {
  const publication = local.getTrackPublication(Track.Source.ScreenShare) as LocalTrackPublication | undefined;
  const track = publication?.videoTrack as LocalVideoTrack | undefined;
  if (!publication || !track) return;

  const preset = videoPresetForOption(video);
  const wasMuted = publication.isMuted;

  await local.unpublishTrack(track, false);
  await local.publishTrack(track, {
    source: Track.Source.ScreenShare,
    screenShareEncoding: preset.encoding,
    simulcast: false,
  });

  if (wasMuted) {
    await track.mute();
  }
}

async function republishMicrophone(
  local: LocalParticipant,
  audio: AudioQualityOption,
  attachGate?: () => Promise<void>
) {
  const publication = local.getTrackPublication(Track.Source.Microphone) as LocalTrackPublication | undefined;
  const track = publication?.audioTrack as LocalAudioTrack | undefined;
  if (!publication || !track || !local.isMicrophoneEnabled) return;

  const wasMuted = publication.isMuted;
  const audioPreset = audioPresetForOption(audio);

  try {
    await track.stopProcessor();
  } catch {
    // Processor may already be absent.
  }

  await local.unpublishTrack(track, false);
  await local.publishTrack(track, {
    source: Track.Source.Microphone,
    audioPreset,
  });

  if (wasMuted) {
    await track.mute();
  } else if (attachGate) {
    await attachGate();
  }
}

async function republishScreenShareAudio(local: LocalParticipant, audio: AudioQualityOption) {
  const publication = local.getTrackPublication(Track.Source.ScreenShareAudio) as LocalTrackPublication | undefined;
  const track = publication?.audioTrack as LocalAudioTrack | undefined;
  if (!publication || !track) return;

  const wasMuted = publication.isMuted;
  const audioPreset = audioPresetForOption(audio);

  await local.unpublishTrack(track, false);
  await local.publishTrack(track, {
    source: Track.Source.ScreenShareAudio,
    audioPreset,
  });

  if (wasMuted) {
    await track.mute();
  }
}

/** Lower/raise local camera (+ screen video) export to match the selected video cap. */
export async function applyLocalVideoExportQuality(
  room: Room,
  video: VideoQualityOption,
  audio: AudioQualityOption,
  options: { videoDeviceId?: string }
) {
  syncRoomOptions(room, video, audio);

  await republishCamera(room.localParticipant, video, options.videoDeviceId);
  await republishScreenShareVideo(room.localParticipant, video);
}

/** Lower/raise local mic (+ screen audio) export to match the selected audio cap. */
export async function applyLocalAudioExportQuality(
  room: Room,
  video: VideoQualityOption,
  audio: AudioQualityOption,
  options: { attachMicGate?: () => Promise<void> }
) {
  syncRoomOptions(room, video, audio);

  await republishMicrophone(room.localParticipant, audio, options.attachMicGate);
  await republishScreenShareAudio(room.localParticipant, audio);
}
