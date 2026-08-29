import { describe, expect, it } from "vitest";
import { normalizeApiPath } from "./apiPath.js";

describe("normalizeApiPath contract", () => {
  it("strips standalone /api prefix", () => {
    expect(normalizeApiPath("/api/dashboard")).toBe("/dashboard");
    expect(normalizeApiPath("/api")).toBe("/");
  });

  it("strips default /heimdall/dev-api mount", () => {
    expect(normalizeApiPath("/heimdall/dev-api/dashboard")).toBe("/dashboard");
    expect(normalizeApiPath("/heimdall/dev-api/health")).toBe("/health");
    expect(normalizeApiPath("/heimdall/dev-api")).toBe("/");
  });

  it("strips root-mount /dev-api", () => {
    expect(normalizeApiPath("/dev-api/dashboard")).toBe("/dashboard");
    expect(normalizeApiPath("/dev-api/health")).toBe("/health");
    expect(normalizeApiPath("/dev-api")).toBe("/");
  });

  it("strips host-joined basePath + /dev-api", () => {
    expect(normalizeApiPath("/my-app/heimdall/dev-api/dashboard", "/my-app/heimdall")).toBe("/dashboard");
  });

  it("still accepts legacy /docs/dev-api for compare tooling", () => {
    expect(normalizeApiPath("/docs/dev-api/dashboard")).toBe("/dashboard");
  });
});
