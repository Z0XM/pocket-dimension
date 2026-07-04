/** Stable tile/avatar colors per participant — matches the zeo icon palette. */
export const PARTICIPANT_COLORS = ["#16a34a", "#7c3aed", "#ca8a04", "#dc2626", "#2563eb", "#c2410c"] as const;

export type ParticipantColor = (typeof PARTICIPANT_COLORS)[number];

/** Previous palette — maps stored preferences to the darker equivalents. */
const LEGACY_PARTICIPANT_COLORS: Record<string, ParticipantColor> = {
  "#22c55e": "#16a34a",
  "#8b5cf6": "#7c3aed",
  "#eab308": "#ca8a04",
  "#ef4444": "#dc2626",
  "#3b82f6": "#2563eb",
  "#ea580c": "#c2410c",
};

export const PARTICIPANT_COLOR_LABELS: Record<ParticipantColor, string> = {
  "#16a34a": "Green",
  "#7c3aed": "Purple",
  "#ca8a04": "Yellow",
  "#dc2626": "Red",
  "#2563eb": "Blue",
  "#c2410c": "Orange",
};

export function isParticipantColor(value: string): value is ParticipantColor {
  return (PARTICIPANT_COLORS as readonly string[]).includes(value);
}

export function resolveParticipantColor(value: string): ParticipantColor | null {
  if (isParticipantColor(value)) return value;
  return LEGACY_PARTICIPANT_COLORS[value] ?? null;
}

export function participantColorForIdentity(identity: string): ParticipantColor {
  let hash = 0;
  for (let i = 0; i < identity.length; i++) {
    hash = (hash + identity.charCodeAt(i) * (i + 1)) >>> 0;
  }
  return PARTICIPANT_COLORS[hash % PARTICIPANT_COLORS.length];
}

export function tileColorForParticipant(
  identity: string,
  options?: { localIdentity?: string | null; preferredColor?: ParticipantColor | null }
): ParticipantColor {
  if (options?.localIdentity && identity === options.localIdentity && options.preferredColor) {
    return options.preferredColor;
  }
  return participantColorForIdentity(identity);
}
