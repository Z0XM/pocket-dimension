export type ParsedMediaUrl =
  | { kind: "youtube_video"; videoId: string; identityKey: string; canonicalUrl: string }
  | { kind: "youtube_playlist"; playlistId: string; identityKey: string | null; canonicalUrl: string }
  | { kind: "generic"; identityKey: string; canonicalUrl: string };

const YT_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"]);

function hostOf(url: URL) {
  return url.hostname.toLowerCase();
}

/** Extract YouTube video id from common URL shapes. */
export function extractYoutubeVideoId(raw: string): string | null {
  try {
    const url = new URL(raw.trim());
    const host = hostOf(url);
    if (host === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0];
      return id && /^[\w-]{11}$/.test(id) ? id : null;
    }
    if (!YT_HOSTS.has(host)) return null;
    if (url.pathname.startsWith("/shorts/")) {
      const id = url.pathname.split("/")[2];
      return id && /^[\w-]{11}$/.test(id) ? id : null;
    }
    if (url.pathname.startsWith("/embed/") || url.pathname.startsWith("/live/")) {
      const id = url.pathname.split("/")[2];
      return id && /^[\w-]{11}$/.test(id) ? id : null;
    }
    const v = url.searchParams.get("v");
    if (v && /^[\w-]{11}$/.test(v)) return v;
    return null;
  } catch {
    return null;
  }
}

export function extractYoutubePlaylistId(raw: string): string | null {
  try {
    const url = new URL(raw.trim());
    if (!YT_HOSTS.has(hostOf(url)) && hostOf(url) !== "youtu.be") return null;
    const list = url.searchParams.get("list");
    if (list && /^[\w-]+$/.test(list)) return list;
    return null;
  } catch {
    return null;
  }
}

export function parseMediaUrl(raw: string): ParsedMediaUrl | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  const playlistId = extractYoutubePlaylistId(trimmed);
  const videoId = extractYoutubeVideoId(trimmed);

  // Playlist URL without a specific video → playlist expand
  if (playlistId && !videoId) {
    return {
      kind: "youtube_playlist",
      playlistId,
      identityKey: null,
      canonicalUrl: `https://www.youtube.com/playlist?list=${playlistId}`,
    };
  }

  // Watch URL that also has list= — treat as single video ingest (playlist import is explicit playlist URLs)
  if (videoId) {
    return {
      kind: "youtube_video",
      videoId,
      identityKey: `youtube:${videoId}`,
      canonicalUrl: `https://www.youtube.com/watch?v=${videoId}`,
    };
  }

  if (playlistId) {
    return {
      kind: "youtube_playlist",
      playlistId,
      identityKey: null,
      canonicalUrl: `https://www.youtube.com/playlist?list=${playlistId}`,
    };
  }

  // Generic public media URL — identity by normalized URL hash later; use url: prefix with host+path
  const identityKey = `url:${url.host}${url.pathname}${url.search}`;
  return { kind: "generic", identityKey, canonicalUrl: url.toString() };
}
