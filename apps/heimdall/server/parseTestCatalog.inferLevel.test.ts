import { describe, expect, it } from "vitest";
import { inferTestLevel } from "./parseTestCatalog.js";

describe("inferTestLevel", () => {
  it("classifies flows package unit tests as L1 (not L4)", () => {
    expect(inferTestLevel("fastify/src/flows/engine.test.ts", "")).toBe("L1");
    expect(inferTestLevel("fastify/src/flows/authoring.test.ts", 'import { defineFlow } from "./authoring"')).toBe("L1");
  });

  it("keeps flows package unit tests as L1 even when content mentions inject", () => {
    expect(inferTestLevel("fastify/src/flows/routes.test.ts", 'await app.inject({ method: "GET" })')).toBe("L1");
  });

  it("classifies consumer flow journey smoke suites as L4", () => {
    expect(inferTestLevel("tests/flows.smoke.test.ts", "")).toBe("L4");
    expect(inferTestLevel("src/app/plans/plans.flow.smoke.test.ts", "")).toBe("L4");
    expect(inferTestLevel("tests/l4/checkout.journey.test.ts", "")).toBe("L4");
  });

  it("still classifies route inject suites as L2", () => {
    expect(inferTestLevel("src/app/routes/plans/plans.test.ts", "fastify.inject")).toBe("L2");
  });
});
