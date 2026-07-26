/** Video IDs whose audio URL has been resolved in the music worker (process-local). */
const readyVideoIds = new Set<string>();

export function isListeningMediaReady(videoId: string) {
  return readyVideoIds.has(videoId);
}

/** @returns true when this videoId was newly marked ready. */
export function markListeningMediaReady(videoId: string) {
  const id = videoId.trim();
  if (!id || readyVideoIds.has(id)) return false;
  readyVideoIds.add(id);
  return true;
}

export function listListeningMediaReady(videoIds?: string[]) {
  if (!videoIds) return [...readyVideoIds];
  return videoIds.filter((id) => readyVideoIds.has(id));
}
