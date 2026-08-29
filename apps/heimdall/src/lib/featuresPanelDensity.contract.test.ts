import { describe, expect, it } from "vitest";
import {
  FEATURES_PROJECT_AREAS_FORBIDDEN_SCROLL_PATTERNS,
  FEATURES_PROJECT_AREAS_MAX_HEIGHT_REM,
  FEATURES_PROJECT_AREAS_MAX_HEIGHT_VH,
  FEATURES_PROJECT_AREAS_SCROLL_MAX_H_BASE,
  FEATURES_PROJECT_AREAS_SCROLL_MAX_H_SM,
  featuresProjectAreasScrollClassName,
} from "./featuresPanelDensity";

describe("featuresPanelDensity", () => {
  it("locks Project areas scroll ceilings at compact caps", () => {
    expect(FEATURES_PROJECT_AREAS_SCROLL_MAX_H_BASE).toBe("max-h-40");
    expect(FEATURES_PROJECT_AREAS_SCROLL_MAX_H_SM).toBe("sm:max-h-[42vh]");
    expect(FEATURES_PROJECT_AREAS_MAX_HEIGHT_REM).toBeLessThanOrEqual(10);
    expect(FEATURES_PROJECT_AREAS_MAX_HEIGHT_VH).toBeLessThanOrEqual(42);
  });

  it("does not include tall viewport-relative caps", () => {
    const classes = featuresProjectAreasScrollClassName();
    for (const pattern of FEATURES_PROJECT_AREAS_FORBIDDEN_SCROLL_PATTERNS) {
      expect(classes).not.toMatch(pattern);
    }
  });
});
