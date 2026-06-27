/** Stable tile/avatar colors per participant — matches the zeo icon palette. */
export const PARTICIPANT_COLORS = ["#22c55e", "#8b5cf6", "#eab308", "#ef4444", "#3b82f6", "#ea580c"] as const;

export type ParticipantColor = (typeof PARTICIPANT_COLORS)[number];

export function participantColorForIdentity(identity: string): ParticipantColor {
  let hash = 0;
  for (let i = 0; i < identity.length; i++) {
    hash = (hash + identity.charCodeAt(i) * (i + 1)) >>> 0;
  }
  return PARTICIPANT_COLORS[hash % PARTICIPANT_COLORS.length];
}
