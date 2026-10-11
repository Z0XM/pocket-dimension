import { describe, expect, test } from "bun:test";
import { canAddToQueue, canControlTransport, canEndSession, canManageGuestPermissions } from "./permissions";

describe("session permissions", () => {
  test("host always can add/control/manage/end", () => {
    const flags = { guestsCanAdd: false, guestsCanControl: false };
    expect(canAddToQueue("host", flags)).toBe(true);
    expect(canControlTransport("host", flags)).toBe(true);
    expect(canManageGuestPermissions("host")).toBe(true);
    expect(canEndSession("host")).toBe(true);
  });

  test("guest listen-only by default", () => {
    const flags = { guestsCanAdd: false, guestsCanControl: false };
    expect(canAddToQueue("guest", flags)).toBe(false);
    expect(canControlTransport("guest", flags)).toBe(false);
    expect(canManageGuestPermissions("guest")).toBe(false);
    expect(canEndSession("guest")).toBe(false);
  });

  test("guest grants via host flags", () => {
    expect(canAddToQueue("guest", { guestsCanAdd: true, guestsCanControl: false })).toBe(true);
    expect(canControlTransport("guest", { guestsCanAdd: false, guestsCanControl: true })).toBe(true);
  });

  test("non-member denied", () => {
    const flags = { guestsCanAdd: true, guestsCanControl: true };
    expect(canAddToQueue(null, flags)).toBe(false);
    expect(canControlTransport(null, flags)).toBe(false);
  });
});
