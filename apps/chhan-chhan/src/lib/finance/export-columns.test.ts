import { describe, expect, test } from "bun:test";
import { EXPORT_COLUMNS, normalizeExportColumns } from "./export-columns";

describe("export columns", () => {
  test("balance is optional and can be omitted", () => {
    expect(EXPORT_COLUMNS.find((col) => col.id === "balance")?.required).toBeFalsy();
    expect(normalizeExportColumns(["date", "merchant", "amount"])).toEqual(["date", "merchant", "amount"]);
  });

  test("space balance only when opted in via space filter", () => {
    expect(normalizeExportColumns(["date", "merchant", "amount", "spaceBalance"])).not.toContain("spaceBalance");
    expect(normalizeExportColumns(["date", "merchant", "amount", "spaceBalance"], { includeSpaceBalance: true })).toContain(
      "spaceBalance"
    );
  });
});
