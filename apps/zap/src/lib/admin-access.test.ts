import { describe, expect, test } from "bun:test";
import {
  LAST_SEEN_THROTTLE_MS,
  canUsePortal,
  isPortalGatedRoute,
  isUuid,
  parsePortalAccessMode,
  parseUserAccessStatus,
  resolvePortalAccess,
  shouldTouchLastSeen,
  validateAccessChange,
} from "./admin-access";

describe("resolvePortalAccess", () => {
  test("admins always get in, even if a stale block exists", () => {
    expect(resolvePortalAccess({ isAdmin: true, status: "blocked", mode: "allowlist" })).toBe("admin");
  });

  test("explicit status wins over the portal mode", () => {
    expect(resolvePortalAccess({ isAdmin: false, status: "blocked", mode: "open" })).toBe("blocked");
    expect(resolvePortalAccess({ isAdmin: false, status: "allowed", mode: "allowlist" })).toBe("allowed");
  });

  test("default status follows the mode", () => {
    expect(resolvePortalAccess({ isAdmin: false, status: "default", mode: "open" })).toBe("allowed");
    expect(resolvePortalAccess({ isAdmin: false, status: "default", mode: "allowlist" })).toBe("pending");
  });

  test("only admin/allowed can use the portal", () => {
    expect(canUsePortal("admin")).toBe(true);
    expect(canUsePortal("allowed")).toBe(true);
    expect(canUsePortal("blocked")).toBe(false);
    expect(canUsePortal("pending")).toBe(false);
  });
});

describe("isPortalGatedRoute", () => {
  test("gates protected pages and every API", () => {
    expect(isPortalGatedRoute("/(protected)/home", "/home")).toBe(true);
    expect(isPortalGatedRoute("/(protected)/admin/users", "/admin/users")).toBe(true);
    expect(isPortalGatedRoute("/api/media/[id]/audio", "/api/media/x/audio")).toBe(true);
    expect(isPortalGatedRoute(null, "/api/unknown")).toBe(true);
    expect(isPortalGatedRoute("/api/auth/youtube/start", "/api/auth/youtube/start")).toBe(true);
  });

  test("leaves auth pages, the blocked page, health and landing reachable", () => {
    expect(isPortalGatedRoute("/blocked", "/blocked")).toBe(false);
    expect(isPortalGatedRoute("/(auth)/login", "/login")).toBe(false);
    expect(isPortalGatedRoute("/health", "/health")).toBe(false);
    expect(isPortalGatedRoute("/", "/")).toBe(false);
    expect(isPortalGatedRoute(null, "/apix")).toBe(false);
  });
});

describe("validateAccessChange", () => {
  const base = { actorUserId: "a", targetUserId: "b", targetIsAdmin: false };

  test("can't block yourself or an admin", () => {
    expect(validateAccessChange({ ...base, targetUserId: "a", change: { kind: "status", status: "blocked" } })).toMatch(/yourself/);
    expect(validateAccessChange({ ...base, targetIsAdmin: true, change: { kind: "status", status: "blocked" } })).toMatch(/admin/i);
  });

  test("can't drop your own admin role", () => {
    expect(validateAccessChange({ ...base, targetUserId: "a", change: { kind: "admin", isAdmin: false } })).toMatch(/own admin/);
  });

  test("normal changes pass", () => {
    expect(validateAccessChange({ ...base, change: { kind: "status", status: "blocked" } })).toBeNull();
    expect(validateAccessChange({ ...base, change: { kind: "status", status: "allowed" } })).toBeNull();
    expect(validateAccessChange({ ...base, targetIsAdmin: true, change: { kind: "admin", isAdmin: false } })).toBeNull();
    expect(validateAccessChange({ ...base, change: { kind: "admin", isAdmin: true } })).toBeNull();
  });
});

describe("parsers and helpers", () => {
  test("mode defaults to open", () => {
    expect(parsePortalAccessMode("allowlist")).toBe("allowlist");
    expect(parsePortalAccessMode("nope")).toBe("open");
    expect(parsePortalAccessMode(null)).toBe("open");
  });

  test("status parser rejects unknown values", () => {
    expect(parseUserAccessStatus("blocked")).toBe("blocked");
    expect(parseUserAccessStatus("admin")).toBeNull();
  });

  test("uuid guard", () => {
    expect(isUuid("0192f3a4-5b6c-7d8e-9f01-23456789abcd")).toBe(true);
    expect(isUuid("not-a-uuid")).toBe(false);
    expect(isUuid(null)).toBe(false);
  });

  test("last seen is throttled", () => {
    const now = new Date("2026-10-18T12:00:00Z");
    expect(shouldTouchLastSeen(null, now)).toBe(true);
    expect(shouldTouchLastSeen(new Date(now.getTime() - 1000), now)).toBe(false);
    expect(shouldTouchLastSeen(new Date(now.getTime() - LAST_SEEN_THROTTLE_MS), now)).toBe(true);
  });
});
