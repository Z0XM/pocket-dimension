export const DEFAULT_MAX_CONCURRENT_ROOMS = 2;
export const DEFAULT_MAX_PARTICIPANTS_PER_ROOM = 6;
export const ROOM_EMPTY_GRACE_SECONDS = 60;
export const GUEST_TOKEN_RATE_LIMIT = 20;
export const GUEST_TOKEN_RATE_WINDOW_MS = 60 * 60 * 1000;

/** @deprecated Use getOperatorSettings() — kept for static fallbacks */
export const MAX_CONCURRENT_ROOMS = DEFAULT_MAX_CONCURRENT_ROOMS;
/** @deprecated Use getOperatorSettings() — kept for static fallbacks */
export const MAX_PARTICIPANTS_PER_ROOM = DEFAULT_MAX_PARTICIPANTS_PER_ROOM;
