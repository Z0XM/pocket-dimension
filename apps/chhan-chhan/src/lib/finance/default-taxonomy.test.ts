import { describe, expect, test } from "bun:test";
import { DEFAULT_TAGS, REFUND_TAG_NAME, SPLIT_RETURN_TAG_NAME, isRefundTagName } from "./default-taxonomy";

describe("DEFAULT_TAGS", () => {
  test("includes refund and bill tags used by special flows", () => {
    const names = DEFAULT_TAGS.map((tag) => tag.name);
    expect(names).toContain(REFUND_TAG_NAME);
    expect(names).toContain(SPLIT_RETURN_TAG_NAME);
    expect(names).toContain("Monthly Bill");
    expect(names).toContain("Yearly Bill");
    expect(names).toContain("Personal");
  });

  test("isRefundTagName recognizes refund tags", () => {
    expect(isRefundTagName(REFUND_TAG_NAME)).toBe(true);
    expect(isRefundTagName(SPLIT_RETURN_TAG_NAME)).toBe(true);
    expect(isRefundTagName("Food")).toBe(false);
  });
});
