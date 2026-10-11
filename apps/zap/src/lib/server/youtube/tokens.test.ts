import { describe, expect, test } from "bun:test";
import { decryptToken, encryptToken } from "./tokens";

describe("youtube token crypto", () => {
  test("round-trip encrypt/decrypt", () => {
    Bun.env.BETTER_AUTH_SECRET = Bun.env.BETTER_AUTH_SECRET || "test-better-auth-secret-for-zap-phase4";
    const plain = "ya29.a0AfH6SMB-test-refresh-token";
    const enc = encryptToken(plain);
    expect(enc.split(".")).toHaveLength(3);
    expect(enc).not.toContain(plain);
    expect(decryptToken(enc)).toBe(plain);
  });

  test("rejects malformed payload", () => {
    Bun.env.BETTER_AUTH_SECRET = Bun.env.BETTER_AUTH_SECRET || "test-better-auth-secret-for-zap-phase4";
    expect(() => decryptToken("not.valid")).toThrow();
  });
});
