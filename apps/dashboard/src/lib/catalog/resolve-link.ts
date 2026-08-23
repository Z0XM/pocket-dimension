import { encodePathSegments } from "$lib/docs-path";
import type { TreeId } from "$lib/types";

export type ResolveLinkInput = {
  href: string;
  sourcePath: string;
  tree: TreeId;
  exists?: (normalizedTreeRelativePath: string) => boolean;
};

export type ResolveLinkResult = { unresolved: true; reason?: string } | { unresolved?: false; href: string; kind: "reader" | "hash" | "external" };

const DANGEROUS_SCHEMES = /^(javascript|data|vbscript):/i;
const EXTERNAL_SCHEMES = /^(https?|mailto|tel|sms|xmpp|irc):/i;

/** Pure relative-path resolution under a posix tree root (no fs). */
export function resolveRelativeTreePath(baseDir: string, hrefPath: string): string | null {
  const normalizedBase = baseDir.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  const normalizedHref = hrefPath.replace(/\\/g, "/");

  if (/^[a-zA-Z]:[/\\]/.test(hrefPath) || normalizedHref.startsWith("/")) {
    return null;
  }

  const baseSegments = normalizedBase ? normalizedBase.split("/") : [];
  const hrefSegments = normalizedHref.split("/");
  const resolved: string[] = [...baseSegments];

  for (const segment of hrefSegments) {
    if (segment === "" || segment === ".") {
      continue;
    }
    if (segment === "..") {
      if (resolved.length === 0) {
        return null;
      }
      resolved.pop();
      continue;
    }
    resolved.push(segment);
  }

  return resolved.join("/");
}

function splitHrefParts(href: string): { path: string; query: string; hash: string } {
  let rest = href;
  let hash = "";
  const hashIndex = rest.indexOf("#");
  if (hashIndex !== -1) {
    hash = rest.slice(hashIndex);
    rest = rest.slice(0, hashIndex);
  }

  let query = "";
  const queryIndex = rest.indexOf("?");
  if (queryIndex !== -1) {
    query = rest.slice(queryIndex);
    rest = rest.slice(0, queryIndex);
  }

  return { path: rest, query, hash };
}

function decodePathSegments(path: string): string {
  return path
    .split("/")
    .map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    })
    .join("/");
}

function buildReaderHref(tree: TreeId, targetPath: string, query: string, hash: string): string {
  const encoded = encodePathSegments(targetPath);
  const url = new URL(`http://local/docs/${encoded}`);
  url.searchParams.set("tree", tree);
  if (query) {
    const params = new URLSearchParams(query.startsWith("?") ? query.slice(1) : query);
    for (const [key, value] of params) {
      url.searchParams.append(key, value);
    }
  }
  if (hash) {
    url.hash = hash.startsWith("#") ? hash.slice(1) : hash;
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

/** Map a sanitized markdown href to an in-root Reader URL, hash, external, or unresolved. */
export function resolveLink(input: ResolveLinkInput): ResolveLinkResult {
  const rawHref = input.href.trim();
  if (!rawHref) {
    return { unresolved: true, reason: "empty href" };
  }

  const normalizedHref = rawHref.replace(/\\/g, "/");

  if (DANGEROUS_SCHEMES.test(normalizedHref)) {
    return { unresolved: true, reason: "disallowed scheme" };
  }

  if (normalizedHref.startsWith("#")) {
    return { kind: "hash", href: normalizedHref };
  }

  if (EXTERNAL_SCHEMES.test(normalizedHref)) {
    return { kind: "external", href: rawHref };
  }

  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(normalizedHref)) {
    return { unresolved: true, reason: "unsupported scheme" };
  }

  const { path, query, hash } = splitHrefParts(normalizedHref);
  const sourceDir = dirname(input.sourcePath);
  const decodedPath = decodePathSegments(path);
  const resolvedPath = resolveRelativeTreePath(sourceDir, decodedPath);

  if (resolvedPath === null) {
    return { unresolved: true, reason: "path escapes tree root" };
  }

  if (input.exists && !input.exists(resolvedPath)) {
    return { unresolved: true, reason: "target missing" };
  }

  const readerHref = buildReaderHref(input.tree, resolvedPath, query, hash);
  return { kind: "reader", href: readerHref };
}

function dirname(sourcePath: string): string {
  const normalized = sourcePath.replace(/\\/g, "/");
  const index = normalized.lastIndexOf("/");
  if (index === -1) {
    return "";
  }
  return normalized.slice(0, index);
}
