import { describe, expect, test } from "bun:test";
import { extractApiTokenFromHeaders } from "./api-tokens";

describe("extractApiTokenFromHeaders", () => {
  test("reads Bearer token", () => {
    const headers = new Headers({ Authorization: "Bearer pd_abc_secret" });
    expect(extractApiTokenFromHeaders(headers)).toBe("pd_abc_secret");
  });

  test("reads X-Api-Key", () => {
    const headers = new Headers({ "X-Api-Key": "pd_abc_secret" });
    expect(extractApiTokenFromHeaders(headers)).toBe("pd_abc_secret");
  });

  test("prefers X-Api-Key over Authorization", () => {
    const headers = new Headers({
      Authorization: "Bearer other",
      "X-Api-Key": "pd_preferred",
    });
    expect(extractApiTokenFromHeaders(headers)).toBe("pd_preferred");
  });

  test("returns null when missing", () => {
    expect(extractApiTokenFromHeaders(new Headers())).toBeNull();
  });
});
