import { describe, expect, it } from "bun:test";
import { slugFromSourcePath } from "./slug";

describe("slugFromSourcePath", () => {
  it("produces stable kebab ids from posix paths", () => {
    expect(slugFromSourcePath("planning-artifacts/epics-dashboard.md")).toBe("planning-artifacts--epics-dashboard");
    expect(slugFromSourcePath("implementation-artifacts/2-1-browse-docs-grouped-by-artifact-kind.md")).toBe(
      "implementation-artifacts--2-1-browse-docs-grouped-by-artifact-kind"
    );
  });

  it("strips leading slashes and normalizes extensions", () => {
    expect(slugFromSourcePath("/project-context.md")).toBe("project-context");
    expect(slugFromSourcePath("implementation-artifacts/sprint-status-dashboard.yaml")).toBe("implementation-artifacts--sprint-status-dashboard");
  });

  it("produces unique slugs for different paths", () => {
    const a = slugFromSourcePath("planning-artifacts/architecture.md");
    const b = slugFromSourcePath("architecture-watchlist.md");
    expect(a).not.toBe(b);
  });
});
