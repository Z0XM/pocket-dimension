import { describe, expect, test } from "bun:test";
import { getAssetPublicUrl } from "./storage";

describe("asset storage urls", () => {
  test("uses CDN base when configured", () => {
    const previous = process.env.RHYMES_ASSET_PUBLIC_BASE_URL;
    process.env.RHYMES_ASSET_PUBLIC_BASE_URL = "https://cdn.example.com/rhymes";
    expect(getAssetPublicUrl("title.png")).toBe("https://cdn.example.com/rhymes/title.png");
    process.env.RHYMES_ASSET_PUBLIC_BASE_URL = previous;
  });

  test("falls back to local static path", () => {
    const previous = process.env.RHYMES_ASSET_PUBLIC_BASE_URL;
    delete process.env.RHYMES_ASSET_PUBLIC_BASE_URL;
    expect(getAssetPublicUrl("title.png")).toBe("/uploads/rhymes/title.png");
    process.env.RHYMES_ASSET_PUBLIC_BASE_URL = previous;
  });
});
