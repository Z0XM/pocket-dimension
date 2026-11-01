import { describe, expect, test } from "bun:test";
import { parseSummaryPeriod } from "./summary";

describe("parseSummaryPeriod", () => {
  test("defaults missing and unknown values to all", () => {
    expect(parseSummaryPeriod(null)).toBe("all");
    expect(parseSummaryPeriod("")).toBe("all");
    expect(parseSummaryPeriod("nope")).toBe("all");
  });

  test("accepts explicit period values", () => {
    expect(parseSummaryPeriod("month")).toBe("month");
    expect(parseSummaryPeriod("year")).toBe("year");
    expect(parseSummaryPeriod("all")).toBe("all");
  });
});
