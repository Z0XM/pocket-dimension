/**
 * Strip mount prefixes used by standalone Vite or host embed.
 * Supports /api, /dev-api, {base}/api, {base}/dev-api, and legacy /heimdall/* mounts.
 */
export function normalizeApiPath(pathname: string, basePath = ""): string {
  const base = basePath.replace(/\/$/, "");
  const prefixes = [...(base ? [`${base}/dev-api`, `${base}/api`] : ["/dev-api"]), "/heimdall/dev-api", "/heimdall/api", "/docs/dev-api", "/api"];

  for (const prefix of prefixes) {
    if (pathname === prefix) return "/";
    if (pathname.startsWith(`${prefix}/`)) {
      return pathname.slice(prefix.length);
    }
  }
  return pathname;
}
