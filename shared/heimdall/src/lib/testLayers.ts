/** Packages monorepo Module / package folder names used as Vitest layer groups. */
export const PACKAGE_LAYER_IDS = [
  "commons",
  "divinity",
  "expression-parser",
  "fastify",
  "heimdall",
  "schema-core",
  "schema-workspace",
  "security",
  "sql-engine",
] as const;

const PACKAGE_LAYER_SET = new Set<string>(PACKAGE_LAYER_IDS);

/** Map catalog `area` (path-ish) to a top-level Tests layer / module group. */
export function layerOf(area: string): string {
  const top = area.split("/")[0] ?? area;
  if (top === "l3") return "L3 Feature";
  if (top === "routes") return "Routes";
  if (top === "services") return "Services";
  if (top === "repository") return "Repository";
  if (top === "models") return "Models";
  if (top === "shared") return "Shared";
  if (top === "plugins") return "Plugins";
  if (top === "flows") return "Flows";
  if (area.startsWith("packages/heimdall") || area.startsWith("heimdall/")) return "heimdall";
  if (top === "schema") return "Schema";
  if (PACKAGE_LAYER_SET.has(top)) return top;
  return "Other";
}

/** Subsection label under a layer — drop package prefix for monorepo packages. */
export function areaLabel(area: string): string {
  const parts = area.split("/");
  if (parts.length <= 1) return area;
  if (PACKAGE_LAYER_SET.has(parts[0]!)) {
    return parts.slice(1).join("/") || parts[0]!;
  }
  return parts.slice(1).join("/") || area;
}

/** Preferred layer display order (common app layers, then package Modules, then leftovers). */
export function orderedTestLayers(present: Iterable<string>): string[] {
  const preferredOrder = ["L3 Feature", "Routes", "Services", "Repository", "Models", "Shared", "Plugins", "Flows", "Schema", ...PACKAGE_LAYER_IDS];
  const presentSet = new Set(present);
  const remaining = [...presentSet].filter((layer) => layer !== "Other" && !preferredOrder.includes(layer)).sort((a, b) => a.localeCompare(b));
  return [...preferredOrder, ...remaining, "Other"].filter((layer) => presentSet.has(layer));
}
