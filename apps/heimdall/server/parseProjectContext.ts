/** Parsed naming metadata from docs/project-context.md frontmatter. */

export interface ProjectContextMeta {
  /** Compenly module display name (e.g. sidebar brand). */
  moduleName: string;
  /** Backend service / repo display name. */
  projectName: string;
}

const DEFAULTS: ProjectContextMeta = {
  moduleName: "Project",
  projectName: "Project",
};

function parseFrontmatterValue(block: string, key: string): string | undefined {
  const re = new RegExp(`^${key}:\\s*(.+)$`, "im");
  const match = block.match(re);
  return match?.[1]?.trim();
}

/** Read module_name and project_name from project-context.md YAML frontmatter. */
export function parseProjectContext(content: string): ProjectContextMeta {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return { ...DEFAULTS };

  const block = match[1];
  const moduleName = parseFrontmatterValue(block, "module_name");
  const projectName = parseFrontmatterValue(block, "project_name");

  return {
    moduleName: moduleName || DEFAULTS.moduleName,
    projectName: projectName || DEFAULTS.projectName,
  };
}
