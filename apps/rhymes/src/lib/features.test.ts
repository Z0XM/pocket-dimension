import { describe, expect, test } from "bun:test";
import { TITLE_ART_ENABLED } from "./features";

describe("feature flags", () => {
  test("title art is off unless RHYMES_TITLE_ART_ENABLED=true", () => {
    expect(TITLE_ART_ENABLED).toBe(process.env.RHYMES_TITLE_ART_ENABLED === "true");
  });
});
