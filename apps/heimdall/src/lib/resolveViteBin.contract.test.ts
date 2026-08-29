import path from "node:path";
import { describe, expect, it } from "vitest";
import { packageRoot } from "../lib/packageRoot.js";
import { resolveViteBin } from "../lib/resolveViteBin.js";

describe("resolveViteBin", () => {
  it("resolves vite.js under the package install layout", () => {
    const bin = resolveViteBin(packageRoot());
    expect(path.basename(bin)).toBe("vite.js");
    expect(bin.includes(`${path.sep}vite${path.sep}`)).toBe(true);
  });
});
