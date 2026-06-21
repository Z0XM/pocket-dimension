import { describe, expect, test } from "bun:test";

function parseVisibilityPayload(body: unknown): "public" | "hidden" | null {
  if (!body || typeof body !== "object") return null;
  const visibility = (body as { visibility?: unknown }).visibility;
  return visibility === "public" || visibility === "hidden" ? visibility : null;
}

function parseRatingPayload(body: unknown): number | null {
  if (!body || typeof body !== "object") return null;
  const rating = (body as { rating?: unknown }).rating;
  if (typeof rating !== "number" || !Number.isInteger(rating) || rating < 0 || rating > 10) return null;
  return rating;
}

function parsePermissionPayload(body: unknown): { userId: string; action?: "revoke" } | null {
  if (!body || typeof body !== "object") return null;
  const userId = (body as { userId?: unknown }).userId;
  if (typeof userId !== "string" || userId.length === 0) return null;
  const action = (body as { action?: unknown }).action;
  return { userId, action: action === "revoke" ? "revoke" : undefined };
}

describe("api payload helpers", () => {
  test("visibility payload accepts public and hidden", () => {
    expect(parseVisibilityPayload({ visibility: "public" })).toBe("public");
    expect(parseVisibilityPayload({ visibility: "hidden" })).toBe("hidden");
    expect(parseVisibilityPayload({ visibility: "draft" })).toBeNull();
  });

  test("rating payload enforces integer 0-10", () => {
    expect(parseRatingPayload({ rating: 9 })).toBe(9);
    expect(parseRatingPayload({ rating: 9.5 })).toBeNull();
    expect(parseRatingPayload({ rating: 12 })).toBeNull();
  });

  test("permission payload parses grant and revoke", () => {
    expect(parsePermissionPayload({ userId: "abc" })).toEqual({ userId: "abc" });
    expect(parsePermissionPayload({ userId: "abc", action: "revoke" })).toEqual({
      userId: "abc",
      action: "revoke",
    });
    expect(parsePermissionPayload({ action: "revoke" })).toBeNull();
  });
});
