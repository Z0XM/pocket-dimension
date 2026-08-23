/** Stable Artifact id from tree-root-relative sourcePath (posix `/`). */
export function slugFromSourcePath(sourcePath: string): string {
  return sourcePath
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\.(md|ya?ml)$/i, "")
    .split("/")
    .map((segment) =>
      segment
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
    )
    .filter(Boolean)
    .join("--");
}
