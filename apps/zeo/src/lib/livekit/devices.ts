export type MediaDeviceOption = {
  deviceId: string;
  label: string;
};

export type MediaDeviceLists = {
  audioInputs: MediaDeviceOption[];
  audioOutputs: MediaDeviceOption[];
  videoInputs: MediaDeviceOption[];
};

/** Browser sink id used when no specific output is selected (`HTMLMediaElement.setSinkId`). */
export const SYSTEM_DEFAULT_AUDIO_OUTPUT = "default";

function formatDeviceLabel(label: string) {
  return label
    .replace(/\s*\([0-9a-f]{4}:[0-9a-f]{4}\)/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function compactDeviceLabel(label: string) {
  return formatDeviceLabel(label)
    .replace(/^(Default|Communications)\s*-\s*/i, "")
    .trim();
}

function labelPreferenceScore(label: string) {
  const normalized = label.trim().toLowerCase();
  if (!normalized) return 0;
  if (normalized.startsWith("communications")) return 1;
  if (normalized.startsWith("default")) return 2;
  return 3;
}

function dedupePhysicalDevices(devices: MediaDeviceInfo[]) {
  const byGroup = new Map<string, MediaDeviceInfo>();

  for (const device of devices) {
    const key = device.groupId || device.deviceId;
    const existing = byGroup.get(key);
    if (!existing || labelPreferenceScore(device.label) > labelPreferenceScore(existing.label)) {
      byGroup.set(key, device);
    }
  }

  return Array.from(byGroup.values());
}

function dedupeByLabel(options: MediaDeviceOption[]) {
  const seen = new Map<string, MediaDeviceOption>();
  for (const option of options) {
    if (!seen.has(option.label)) {
      seen.set(option.label, option);
    }
  }
  return Array.from(seen.values());
}

function labelForDevice(device: MediaDeviceInfo, index: number, kind: "audioinput" | "videoinput" | "audiooutput") {
  const fallback = kind === "audioinput" ? `Microphone ${index + 1}` : kind === "videoinput" ? `Camera ${index + 1}` : `Speakers ${index + 1}`;
  if (!device.label) return fallback;
  return compactDeviceLabel(device.label);
}

export async function listMediaDevices(): Promise<MediaDeviceLists> {
  if (!navigator.mediaDevices?.enumerateDevices) {
    return { audioInputs: [], audioOutputs: [], videoInputs: [] };
  }

  const devices = await navigator.mediaDevices.enumerateDevices();

  const audioInputs = dedupeByLabel(
    dedupePhysicalDevices(devices.filter((device) => device.kind === "audioinput")).map((device, index) => ({
      deviceId: device.deviceId,
      label: labelForDevice(device, index, "audioinput"),
    }))
  );

  const audioOutputs = dedupeByLabel(
    dedupePhysicalDevices(devices.filter((device) => device.kind === "audiooutput")).map((device, index) => ({
      deviceId: device.deviceId,
      label: labelForDevice(device, index, "audiooutput"),
    }))
  );

  const videoInputs = dedupeByLabel(
    dedupePhysicalDevices(devices.filter((device) => device.kind === "videoinput")).map((device, index) => ({
      deviceId: device.deviceId,
      label: labelForDevice(device, index, "videoinput"),
    }))
  );

  return { audioInputs, audioOutputs, videoInputs };
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
