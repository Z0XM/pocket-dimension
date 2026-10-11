import { describe, expect, test } from "bun:test";
import { getStorageConfig, normalizeStorageEndpoint } from "./storage";

describe("normalizeStorageEndpoint", () => {
  test("account-level R2 stays path-style and strips trailing slash", () => {
    const r = normalizeStorageEndpoint("https://abc123.r2.cloudflarestorage.com/", "zap-media");
    expect(r).toEqual({
      endpoint: "https://abc123.r2.cloudflarestorage.com",
      bucket: "zap-media",
      virtualHostedStyle: false,
    });
  });

  test("bucket path on account endpoint is peeled into bucket", () => {
    const r = normalizeStorageEndpoint("https://abc123.r2.cloudflarestorage.com/zap-media", "");
    expect(r.endpoint).toBe("https://abc123.r2.cloudflarestorage.com");
    expect(r.bucket).toBe("zap-media");
    expect(r.virtualHostedStyle).toBe(false);
  });

  test("virtual-hosted R2 endpoint sets vhs and bucket", () => {
    const r = normalizeStorageEndpoint("https://zap-media.abc123.r2.cloudflarestorage.com", "");
    expect(r.virtualHostedStyle).toBe(true);
    expect(r.bucket).toBe("zap-media");
    expect(r.endpoint).toBe("https://zap-media.abc123.r2.cloudflarestorage.com");
  });

  test("strips quotes and whitespace via getStorageConfig", () => {
    const cfg = getStorageConfig({
      S3_ENDPOINT: ' "https://abc123.r2.cloudflarestorage.com/" ',
      S3_ACCESS_KEY_ID: '"AKIATEST"',
      S3_SECRET_ACCESS_KEY: "'secretline'\n",
      S3_BUCKET: " zap-media ",
      S3_REGION: "auto",
    });
    expect(cfg).not.toBeNull();
    expect(cfg!.endpoint).toBe("https://abc123.r2.cloudflarestorage.com");
    expect(cfg!.accessKey).toBe("AKIATEST");
    expect(cfg!.secretKey).toBe("secretline");
    expect(cfg!.bucket).toBe("zap-media");
    expect(cfg!.virtualHostedStyle).toBe(false);
  });

  test("rejects placeholder endpoint", () => {
    expect(
      getStorageConfig({
        S3_ENDPOINT: "https://<accountid>.r2.cloudflarestorage.com",
        S3_ACCESS_KEY: "x",
        S3_SECRET_KEY: "y",
        S3_BUCKET: "zap-media",
      })
    ).toBeNull();
  });

  test("accepts short aliases S3_ACCESS_KEY / S3_SECRET_KEY", () => {
    const cfg = getStorageConfig({
      S3_ENDPOINT: "https://abc123.r2.cloudflarestorage.com",
      S3_ACCESS_KEY: "key",
      S3_SECRET_KEY: "secret",
      S3_BUCKET: "zap-media",
    });
    expect(cfg?.accessKey).toBe("key");
    expect(cfg?.secretKey).toBe("secret");
  });
});
