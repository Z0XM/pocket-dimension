import { placeholderUnavailableReason } from "$lib/server/ingest/errors";

export type YouTubeVideoStatusInfo = {
  uploadStatus?: string | null;
  privacyStatus?: string | null;
};

/**
 * Decide from YouTube Data API metadata whether a playlist item is known to be unplayable.
 *
 * `playlistItems.list` still returns deleted / private entries (placeholder title "Deleted video" /
 * "Private video" plus `resourceId.videoId`), while `videos.list` omits them entirely. `video: null`
 * means the id was missing from a successful `videos.list` response.
 * Region blocks are not decided here — they depend on the server's egress country, so the yt-dlp
 * error is classified instead (`classifyUnavailableReason`).
 */
export function youtubeItemUnavailableReason(input: { title: string | null | undefined; video: YouTubeVideoStatusInfo | null }): string | null {
  const placeholder = placeholderUnavailableReason(input.title);
  if (placeholder) return placeholder;
  if (!input.video) return "Video unavailable";
  switch (input.video.uploadStatus) {
    case "deleted":
    case "rejected":
      return "Video removed";
    case "failed":
      return "Video unavailable";
    default:
      return null;
  }
}
