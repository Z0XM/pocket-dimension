import { describe, expect, it } from "bun:test";
import {
  groupDeliveryForTimeline,
  parseDeliveryView,
  parseSprintStatusYaml,
  projectDelivery,
  resolveItemStatus,
  sprintStatusKeyForArtifact,
} from "./delivery";
import type { ArtifactRef } from "$lib/types";

const SPRINT_YAML = `
development_status:
  epic-1: done
  1-1-create-zeo-sveltekit-app-workspace: done
  1-2-integrate-shared-better-auth-routes: in-progress
  2-1-livekit-docker-compose-for-dev-and-production: ready-for-dev
  epic-9: backlog
  epic-9-retrospective: optional
  orphan-key-with-no-file: done
`;

function storyRef(overrides: Partial<ArtifactRef> & Pick<ArtifactRef, "sourcePath">): ArtifactRef {
  return {
    id: overrides.sourcePath.replace(/\//g, "-").replace(/\.md$/, ""),
    title: overrides.title ?? overrides.sourcePath,
    artifactKind: "story",
    ...overrides,
  };
}

function epicRef(overrides: Partial<ArtifactRef> & Pick<ArtifactRef, "sourcePath">): ArtifactRef {
  return {
    id: overrides.sourcePath.replace(/\//g, "-").replace(/\.md$/, ""),
    title: overrides.title ?? overrides.sourcePath,
    artifactKind: "epic",
    ...overrides,
  };
}

describe("parseSprintStatusYaml", () => {
  it("parses development_status map", () => {
    const map = parseSprintStatusYaml(SPRINT_YAML);
    expect(map?.get("1-1-create-zeo-sveltekit-app-workspace")).toBe("done");
    expect(map?.get("epic-1")).toBe("done");
  });

  it("returns null for missing development_status", () => {
    expect(parseSprintStatusYaml("project: zeo\n")).toBeNull();
  });

  it("returns null for invalid yaml", () => {
    expect(parseSprintStatusYaml("development_status: [\n  broken")).toBeNull();
  });
});

describe("sprintStatusKeyForArtifact", () => {
  it("uses story basename stem", () => {
    expect(
      sprintStatusKeyForArtifact({
        artifactKind: "story",
        sourcePath: "implementation-artifacts/1-1-create-zeo-sveltekit-app-workspace.md",
      })
    ).toBe("1-1-create-zeo-sveltekit-app-workspace");
  });

  it("maps numbered epic file to epic-N key", () => {
    expect(
      sprintStatusKeyForArtifact({
        artifactKind: "epic",
        sourcePath: "implementation-artifacts/9-epic-remove-guest-mode.md",
      })
    ).toBe("epic-9");
  });

  it("does not forge epic-N for pack files", () => {
    expect(
      sprintStatusKeyForArtifact({
        artifactKind: "epic",
        sourcePath: "planning-artifacts/epics-dashboard.md",
      })
    ).toBeNull();
  });
});

describe("resolveItemStatus", () => {
  const sprintMap = parseSprintStatusYaml(SPRINT_YAML)!;

  it("prefers sprint map over Status line", () => {
    const artifact = storyRef({
      sourcePath: "implementation-artifacts/1-1-create-zeo-sveltekit-app-workspace.md",
      status: "unknown",
      statusLabel: "ready-for-dev",
    });

    expect(resolveItemStatus(artifact, sprintMap)).toEqual({ status: "done", statusLabel: "done" });
  });

  it("maps in-progress from sprint map", () => {
    const artifact = storyRef({
      sourcePath: "implementation-artifacts/1-2-integrate-shared-better-auth-routes.md",
    });

    expect(resolveItemStatus(artifact, sprintMap)).toEqual({ status: "in-progress", statusLabel: "in-progress" });
  });

  it("maps extra sprint values to unknown with label", () => {
    const artifact = storyRef({
      sourcePath: "implementation-artifacts/2-1-livekit-docker-compose-for-dev-and-production.md",
    });

    expect(resolveItemStatus(artifact, sprintMap)).toEqual({ status: "unknown", statusLabel: "ready-for-dev" });
  });

  it("falls back to Status line when sprint key missing", () => {
    const artifact = storyRef({
      sourcePath: "implementation-artifacts/3-3-walk-delivery-as-board-table-and-timeline.md",
      status: "unknown",
      statusLabel: "ready-for-dev",
    });

    expect(resolveItemStatus(artifact, sprintMap)).toEqual({ status: "unknown", statusLabel: "ready-for-dev" });
  });

  it("returns unknown when no sprint map and no Status line", () => {
    const artifact = storyRef({
      sourcePath: "implementation-artifacts/9-9-no-status-story.md",
    });

    expect(resolveItemStatus(artifact, null)).toEqual({ status: "unknown", statusLabel: "unknown" });
  });
});

describe("projectDelivery", () => {
  it("projects epic and story artifacts only", () => {
    const artifacts: ArtifactRef[] = [
      epicRef({ sourcePath: "planning-artifacts/epics.md", title: "Epics" }),
      storyRef({ sourcePath: "implementation-artifacts/1-1-create-zeo-sveltekit-app-workspace.md", title: "Story 1.1" }),
      {
        id: "prd",
        title: "PRD",
        artifactKind: "prd",
        sourcePath: "planning-artifacts/prds/prd.md",
      },
    ];

    const items = projectDelivery(artifacts, parseSprintStatusYaml(SPRINT_YAML));
    expect(items).toHaveLength(2);
    expect(items.every((item) => item.kind === "epic" || item.kind === "story")).toBe(true);
  });

  it("still projects when sprint yaml is missing", () => {
    const artifacts = [storyRef({ sourcePath: "implementation-artifacts/1-1-create-zeo-sveltekit-app-workspace.md" })];
    const items = projectDelivery(artifacts, null);
    expect(items).toHaveLength(1);
    expect(items[0]?.status).toBe("unknown");
  });

  it("does not invent rows from orphan sprint keys", () => {
    const artifacts = [storyRef({ sourcePath: "implementation-artifacts/1-1-create-zeo-sveltekit-app-workspace.md" })];
    const items = projectDelivery(artifacts, parseSprintStatusYaml(SPRINT_YAML));
    expect(items.some((item) => item.sourcePath.includes("orphan"))).toBe(false);
  });
});

describe("parseDeliveryView", () => {
  it("defaults to board", () => {
    expect(parseDeliveryView(null)).toBe("board");
    expect(parseDeliveryView("")).toBe("board");
    expect(parseDeliveryView("invalid")).toBe("board");
  });

  it("accepts valid views", () => {
    expect(parseDeliveryView("table")).toBe("table");
    expect(parseDeliveryView("timeline")).toBe("timeline");
  });
});

describe("groupDeliveryForTimeline", () => {
  it("orders numbered groups ascending with unnumbered last", () => {
    const items = projectDelivery(
      [
        storyRef({ sourcePath: "implementation-artifacts/2-1-second-epic-story.md" }),
        storyRef({ sourcePath: "implementation-artifacts/1-2-first-epic-story.md" }),
        epicRef({ sourcePath: "planning-artifacts/epics-dashboard.md", title: "Pack" }),
      ],
      null
    );

    const groups = groupDeliveryForTimeline(items);
    expect(groups[0]?.epicNumber).toBe(1);
    expect(groups[1]?.epicNumber).toBe(2);
    expect(groups[1]?.epics.map((epic) => epic.sourcePath)).toEqual(["planning-artifacts/epics-dashboard.md"]);
    expect(groups.some((group) => group.epicNumber === null)).toBe(false);
  });

  it("nests numbered stories under pack epic milestones when no per-number epic files exist", () => {
    const packDashboard = epicRef({
      sourcePath: "planning-artifacts/epics-dashboard.md",
      title: "Dashboard Epics",
    });
    const packRhymes = epicRef({
      sourcePath: "planning-artifacts/epics.md",
      title: "Rhymes Epics",
    });

    const items = projectDelivery(
      [
        packDashboard,
        packRhymes,
        storyRef({ sourcePath: "implementation-artifacts/1-1-run-dashboard-from-the-pocket-sibling-starter.md", title: "1.1 Dashboard" }),
        storyRef({ sourcePath: "implementation-artifacts/2-1-browse-docs-grouped-by-artifact-kind.md", title: "2.1 Docs" }),
        storyRef({
          sourcePath: "implementation-artifacts/1-1-migrate-the-existing-rhymes-library-into-the-new-content-model.md",
          title: "1.1 Rhymes",
        }),
      ],
      null
    );

    const groups = groupDeliveryForTimeline(items);
    const epic1 = groups.find((group) => group.epicNumber === 1);
    const epic2 = groups.find((group) => group.epicNumber === 2);

    expect(epic1?.epics.map((epic) => epic.sourcePath)).toEqual(["planning-artifacts/epics-dashboard.md", "planning-artifacts/epics.md"]);
    expect(epic1?.stories).toHaveLength(2);
    expect(epic2?.epics.map((epic) => epic.sourcePath)).toEqual(["planning-artifacts/epics-dashboard.md", "planning-artifacts/epics.md"]);
    expect(epic2?.stories).toHaveLength(1);
    expect(groups.some((group) => group.epicNumber === null)).toBe(false);
  });

  it("keeps numbered epic files as milestones and does not duplicate pack epics into Other", () => {
    const items = projectDelivery(
      [
        epicRef({ sourcePath: "implementation-artifacts/9-epic-remove-guest-mode.md", title: "Epic 9" }),
        epicRef({ sourcePath: "planning-artifacts/epics.md", title: "Pack" }),
        storyRef({ sourcePath: "implementation-artifacts/1-1-create-zeo-sveltekit-app-workspace.md", title: "1.1" }),
      ],
      null
    );

    const groups = groupDeliveryForTimeline(items);
    const epic9 = groups.find((group) => group.epicNumber === 9);
    const epic1 = groups.find((group) => group.epicNumber === 1);

    expect(epic9?.epics.map((epic) => epic.sourcePath)).toEqual(["implementation-artifacts/9-epic-remove-guest-mode.md"]);
    expect(epic1?.epics.map((epic) => epic.sourcePath)).toEqual(["planning-artifacts/epics.md"]);
    expect(epic1?.stories).toHaveLength(1);
    expect(groups.some((group) => group.epicNumber === null)).toBe(false);
  });

  it("leaves pack epics in Other when no numbered story groups exist", () => {
    const items = projectDelivery([epicRef({ sourcePath: "planning-artifacts/epics-dashboard.md", title: "Pack" })], null);

    const groups = groupDeliveryForTimeline(items);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.epicNumber).toBeNull();
    expect(groups[0]?.epics).toHaveLength(1);
  });
});
