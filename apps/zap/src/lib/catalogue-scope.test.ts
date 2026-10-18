import { describe, expect, test } from "bun:test";
import { parseCatalogueScope } from "./catalogue-scope";

const pl = "0193b0f4-5c6e-7d1a-9b2c-3d4e5f607182";

describe("parseCatalogueScope", () => {
  test("page default is Your library, API default is All", () => {
    expect(parseCatalogueScope(new URLSearchParams(""), "yours")).toEqual({ scope: "yours", playlistId: null });
    expect(parseCatalogueScope(new URLSearchParams(""), "all")).toEqual({ scope: "all", playlistId: null });
  });

  test("explicit scope wins over the default", () => {
    expect(parseCatalogueScope(new URLSearchParams("scope=all"), "yours").scope).toBe("all");
    expect(parseCatalogueScope(new URLSearchParams("scope=yours"), "all").scope).toBe("yours");
  });

  test("playlist scope needs a uuid", () => {
    expect(parseCatalogueScope(new URLSearchParams(`playlist=${pl}&scope=all`), "yours")).toEqual({ scope: "playlist", playlistId: pl });
    expect(parseCatalogueScope(new URLSearchParams("playlist=not-a-uuid"), "yours")).toEqual({ scope: "yours", playlistId: null });
  });
});
