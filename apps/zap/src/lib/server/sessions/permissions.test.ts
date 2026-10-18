import { describe, expect, test } from "bun:test";
import {
  EMPTY_MEMBER_PERMISSIONS,
  canAddToQueue,
  canControlTransport,
  canEndSession,
  canManageSetup,
  canPlayPause,
  canReorderQueue,
  canSeek,
  canSkip,
  effectivePermissions,
} from "./permissions";

describe("session permissions", () => {
  test("host always has full access", () => {
    const eff = effectivePermissions("host", EMPTY_MEMBER_PERMISSIONS);
    expect(eff.canAdd).toBe(true);
    expect(eff.canPlayPause).toBe(true);
    expect(eff.canSkip).toBe(true);
    expect(eff.canSeek).toBe(true);
    expect(eff.canReorder).toBe(true);
    expect(eff.canSetup).toBe(true);
    expect(eff.canControl).toBe(true);
    expect(eff.canManageGuests).toBe(true);
    expect(eff.canEnd).toBe(true);
    expect(canEndSession("host")).toBe(true);
  });

  test("guest listen-only by default", () => {
    expect(canAddToQueue("guest", EMPTY_MEMBER_PERMISSIONS)).toBe(false);
    expect(canControlTransport("guest", EMPTY_MEMBER_PERMISSIONS)).toBe(false);
    expect(canManageSetup("guest", EMPTY_MEMBER_PERMISSIONS)).toBe(false);
    expect(canEndSession("guest")).toBe(false);
  });

  test("guest grants are granular", () => {
    expect(canAddToQueue("guest", { ...EMPTY_MEMBER_PERMISSIONS, canAdd: true })).toBe(true);
    expect(canPlayPause("guest", { ...EMPTY_MEMBER_PERMISSIONS, canPlayPause: true })).toBe(true);
    expect(canSkip("guest", { ...EMPTY_MEMBER_PERMISSIONS, canSkip: true })).toBe(true);
    expect(canSeek("guest", { ...EMPTY_MEMBER_PERMISSIONS, canSeek: true })).toBe(true);
    expect(canReorderQueue("guest", { ...EMPTY_MEMBER_PERMISSIONS, canReorder: true })).toBe(true);
    expect(canManageSetup("guest", { ...EMPTY_MEMBER_PERMISSIONS, canSetup: true })).toBe(true);
    expect(canControlTransport("guest", { ...EMPTY_MEMBER_PERMISSIONS, canSeek: true })).toBe(true);
    expect(canControlTransport("guest", { ...EMPTY_MEMBER_PERMISSIONS, canAdd: true })).toBe(false);
  });

  test("non-member denied", () => {
    expect(canAddToQueue(null, { ...EMPTY_MEMBER_PERMISSIONS, canAdd: true })).toBe(false);
    expect(canControlTransport(null, { ...EMPTY_MEMBER_PERMISSIONS, canPlayPause: true })).toBe(false);
  });
});
