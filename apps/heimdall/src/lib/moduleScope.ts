export type RuntimeModule = { id: string; label: string };

/** Hide Module Scope when flat config or sole Enabled Module (FR-16, UX-DR4). */
export function shouldShowModuleScopeControl(modules: RuntimeModule[]): boolean {
  return modules.length > 1;
}

/**
 * Resolve active Module Scope from `?module=` query and Enabled runtime list.
 * Aligns with server defaults (Story 2.2): multi + missing → "all"; unknown → first Enabled.
 */
export function resolveClientModuleScope(rawQuery: string | null | undefined, modules: RuntimeModule[]): string {
  if (modules.length === 0) return "all";
  if (modules.length === 1) return modules[0]!.id;

  const firstId = modules[0]!.id;
  if (rawQuery == null || rawQuery === "") return "all";
  if (rawQuery === "all") return "all";

  const known = modules.find((m) => m.id === rawQuery);
  return known?.id ?? firstId;
}

/** Dashboard API `?module=` argument for the current scope and runtime list. */
export function dashboardModuleQueryArg(scope: string, modules: RuntimeModule[]): string | undefined {
  if (modules.length === 0) return undefined;
  if (modules.length === 1) return modules[0]!.id;
  return scope;
}
