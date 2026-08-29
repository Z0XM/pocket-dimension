import { describe, expect, it } from "vitest";
import { deriveFeatureDeliveryStatus, summarizeAreaStatus } from "./featureStatus.js";
import type { FeatureRecord, StoryRecord } from "./types.js";

function feature(partial: Partial<FeatureRecord> & Pick<FeatureRecord, "id" | "status" | "epicId">): FeatureRecord {
  return {
    name: partial.name ?? partial.id,
    screens: [],
    goal: undefined,
    includes: [],
    deferred: [],
    seeAlso: [],
    outOfScope: [],
    areaId: "cli",
    area: "cli",
    ...partial,
  };
}

function story(partial: Pick<StoryRecord, "id" | "epicId" | "status">): StoryRecord {
  return {
    id: partial.id,
    epicId: partial.epicId,
    epicNumber: 1,
    number: 1,
    title: partial.id,
    status: partial.status,
    hasImplementationFile: false,
    blockers: [],
    featureIds: [],
  };
}

describe("deriveFeatureDeliveryStatus — Live is complete", () => {
  it("maps registry Live to complete when stories are done or absent", () => {
    expect(deriveFeatureDeliveryStatus(feature({ id: "F-1", status: "Live", epicId: "1" }), [])).toBe("complete");
    expect(
      deriveFeatureDeliveryStatus(feature({ id: "F-1", status: "live", epicId: "1" }), [story({ id: "1-1", epicId: "1", status: "done" })])
    ).toBe("complete");
  });

  it("still prefers active/blocked stories over Live", () => {
    expect(
      deriveFeatureDeliveryStatus(feature({ id: "F-1", status: "Live", epicId: "1" }), [story({ id: "1-1", epicId: "1", status: "in-progress" })])
    ).toBe("in-progress");
    expect(
      deriveFeatureDeliveryStatus(feature({ id: "F-1", status: "Live", epicId: "1" }), [story({ id: "1-1", epicId: "1", status: "blocked" })])
    ).toBe("blocked");
  });
});

describe("summarizeAreaStatus — Live areas are all-complete", () => {
  it("rolls Live features with no stories to all-complete health", () => {
    const features = [feature({ id: "F-1", status: "Live", epicId: "1" }), feature({ id: "F-2", status: "Live", epicId: "1" })];
    const summary = summarizeAreaStatus(features, new Map());
    expect(summary.health).toBe("all-complete");
    expect(summary.complete).toBe(2);
    expect(summary.pending).toBe(0);
  });
});
