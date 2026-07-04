/** Stable tile/avatar colors per participant — matches the zeo icon palette. */
export const PARTICIPANT_COLORS = ["#22c55e", "#8b5cf6", "#eab308", "#ef4444", "#3b82f6", "#ea580c"] as const;

export type ParticipantColor = (typeof PARTICIPANT_COLORS)[number];

export const PARTICIPANT_COLOR_LABELS: Record<ParticipantColor, string> = {
  "#22c55e": "Green",
  "#8b5cf6": "Purple",
  "#eab308": "Yellow",
  "#ef4444": "Red",
  "#3b82f6": "Blue",
  "#ea580c": "Orange",
};

export function isParticipantColor(value: string): value is ParticipantColor {
  return (PARTICIPANT_COLORS as readonly string[]).includes(value);
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
