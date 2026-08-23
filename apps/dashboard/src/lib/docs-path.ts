/** Client-safe path encoding for Docs routes (shared by Catalog and Reader links). */

export function encodePathSegments(sourcePath: string): string {
  return sourcePath
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export function decodePathParam(pathParam: string): string {
  return pathParam
    .split("/")
    .filter((segment) => segment.length > 0)
    .map((segment) => decodeURIComponent(segment))
    .join("/");
}
