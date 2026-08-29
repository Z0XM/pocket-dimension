import { describe, expect, it } from "vitest";
import { areaLabel, layerOf, orderedTestLayers } from "./testLayers";

describe("layerOf", () => {
  it("groups packages monorepo paths by package / module id", () => {
    expect(layerOf("commons/src")).toBe("commons");
    expect(layerOf("fastify/src/flows")).toBe("fastify");
    expect(layerOf("sql-engine/__tests__/parser")).toBe("sql-engine");
    expect(layerOf("heimdall/server")).toBe("heimdall");
    expect(layerOf("expression-parser/__tests__")).toBe("expression-parser");
  });

  it("keeps common app layout layers", () => {
    expect(layerOf("routes/plans")).toBe("Routes");
    expect(layerOf("flows/engine")).toBe("Flows");
  });

  it("falls back to Other for unknown tops", () => {
    expect(layerOf("mystery/foo")).toBe("Other");
  });
});

describe("areaLabel", () => {
  it("strips package prefix under module layers", () => {
    expect(areaLabel("commons/src")).toBe("src");
    expect(areaLabel("fastify/src/flows")).toBe("src/flows");
  });
});

describe("orderedTestLayers", () => {
  it("includes package layers and keeps Other last", () => {
    expect(orderedTestLayers(["Other", "heimdall", "commons", "Routes"])).toEqual(["Routes", "commons", "heimdall", "Other"]);
  });
});
