export type MediaDeviceOption = {
  deviceId: string;
  label: string;
};

export type MediaDeviceLists = {
  audioInputs: MediaDeviceOption[];
  videoInputs: MediaDeviceOption[];
};

function labelForDevice(device: MediaDeviceInfo, index: number, kind: "audio" | "video") {
  if (device.label) return device.label;
  return kind === "audio" ? `Microphone ${index + 1}` : `Camera ${index + 1}`;
}

export async function listMediaDevices(): Promise<MediaDeviceLists> {
  if (!navigator.mediaDevices?.enumerateDevices) {
    return { audioInputs: [], videoInputs: [] };
  }

  const devices = await navigator.mediaDevices.enumerateDevices();

  return {
    audioInputs: devices
      .filter((device) => device.kind === "audioinput")
      .map((device, index) => ({
        deviceId: device.deviceId,
        label: labelForDevice(device, index, "audio"),
      })),
    videoInputs: devices
      .filter((device) => device.kind === "videoinput")
      .map((device, index) => ({
        deviceId: device.deviceId,
        label: labelForDevice(device, index, "video"),
      })),
  };
}

export async function buildMediaConstraints(options: {
  audio: boolean;
  video: boolean;
  audioDeviceId?: string;
  videoDeviceId?: string;
}): Promise<MediaStreamConstraints> {
  return {
    audio: options.audio ? (options.audioDeviceId ? { deviceId: { exact: options.audioDeviceId } } : true) : false,
    video: options.video ? (options.videoDeviceId ? { deviceId: { exact: options.videoDeviceId } } : true) : false,
  };
}
