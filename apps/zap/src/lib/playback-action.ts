/** Pure toggle decision — keeps resume-after-pause from depending on stale UI state. */
export type PlaybackAction = "pause" | "resume" | "load";

export function nextPlaybackAction(loadedSameTrack: boolean, elementPaused: boolean): PlaybackAction {
  if (loadedSameTrack && !elementPaused) return "pause";
  if (loadedSameTrack && elementPaused) return "resume";
  return "load";
}
