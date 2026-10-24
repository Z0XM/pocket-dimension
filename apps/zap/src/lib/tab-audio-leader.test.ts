import { describe, expect, test } from "bun:test";
import { pickLeaderTabId } from "./tab-audio-leader";

describe("pickLeaderTabId", () => {
  const now = 1_000_000;

  test("self wins when alone", () => {
    expect(pickLeaderTabId({ tabId: "a", at: now, visible: true }, [], now)).toBe("a");
  });

  test("prefers a visible peer over an invisible self", () => {
    const self = { tabId: "a", at: now, visible: false };
    const peer = { tabId: "b", at: now - 100, visible: true };
    expect(pickLeaderTabId(self, [peer], now)).toBe("b");
  });

  test("among visible tabs, prefers the freshest heartbeat", () => {
    const self = { tabId: "a", at: now - 500, visible: true };
    const peer = { tabId: "b", at: now, visible: true };
    expect(pickLeaderTabId(self, [peer], now)).toBe("b");
  });

  test("ignores stale peers", () => {
    const self = { tabId: "a", at: now, visible: false };
    const peer = { tabId: "b", at: now - 10_000, visible: true };
    expect(pickLeaderTabId(self, [peer], now)).toBe("a");
  });
});
