import type { TreeId } from "$lib/types";

export type SectionNavItem = {
  label: string;
  href: string;
};

/** Single source of truth for dashboard section navigation (UX-DR6). */
export const SECTION_NAV: readonly SectionNavItem[] = [
  { label: "Overview", href: "/" },
  { label: "Features", href: "/features" },
  { label: "Epics & Stories", href: "/delivery" },
  { label: "Tests", href: "/tests" },
  { label: "Docs", href: "/docs" },
] as const;

/** Section labels that must never appear in nav (architecture §6.3 exclusions). */
export const FORBIDDEN_NAV_LABELS = ["Data", "Sample World", "API", "Blockers", "Questions", "Deferred"] as const;

/** Build a section href, preserving the selected tree query when present. */
export function sectionHref(href: string, tree: TreeId | null): string {
  if (!tree) {
    return href;
  }

  const url = new URL(href, "http://local");
  url.searchParams.set("tree", tree);
  return `${url.pathname}${url.search}`;
}

/** Whether the given pathname matches this section (Overview = `/` exactly). */
export function isSectionActive(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Section links for Overview landing (excludes Overview itself). */
export function overviewSectionLinks(tree: TreeId | null): SectionNavItem[] {
  return SECTION_NAV.filter((item) => item.href !== "/").map((item) => ({
    ...item,
    href: sectionHref(item.href, tree),
  }));
}
