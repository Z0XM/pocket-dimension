import { describe, expect, it } from "bun:test";
import { isEditableTarget } from "./keyboard";

describe("isEditableTarget", () => {
  it("returns false for null and non-element targets", () => {
    expect(isEditableTarget(null)).toBe(false);
    expect(isEditableTarget({} as EventTarget)).toBe(false);
  });
});
