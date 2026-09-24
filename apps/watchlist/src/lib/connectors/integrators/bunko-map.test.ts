import { describe, expect, test } from "bun:test";
import {
  mapBunkoRating,
  mapBunkoRows,
  mapBunkoStatus,
  mapBunkoToCatalogRow,
  mapBunkoToRatingRow,
  mapBunkoType,
} from "./bunko-map";

describe("mapBunkoType", () => {
  test("maps Movies / movies / movie → movie", () => {
    expect(mapBunkoType("Movies")).toEqual({ skip: false, value: "movie" });
    expect(mapBunkoType("movies")).toEqual({ skip: false, value: "movie" });
    expect(mapBunkoType("movie")).toEqual({ skip: false, value: "movie" });
  });

  test("maps Shows / shows / series → series", () => {
    expect(mapBunkoType("Shows")).toEqual({ skip: false, value: "series" });
    expect(mapBunkoType("shows")).toEqual({ skip: false, value: "series" });
    expect(mapBunkoType("series")).toEqual({ skip: false, value: "series" });
  });

  test("skips unknown types", () => {
    expect(mapBunkoType("Shorts").skip).toBe(true);
    expect(mapBunkoType("").skip).toBe(true);
  });
});

describe("mapBunkoStatus", () => {
  test("maps watched (any case) → watched", () => {
    expect(mapBunkoStatus("watched")).toEqual({ skip: false, value: "watched" });
    expect(mapBunkoStatus("Watched")).toEqual({ skip: false, value: "watched" });
  });

  test("maps watchlist → watch_later", () => {
    expect(mapBunkoStatus("watchlist")).toEqual({ skip: false, value: "watch_later" });
    expect(mapBunkoStatus("Watchlist")).toEqual({ skip: false, value: "watch_later" });
  });

  test("skips unknown status", () => {
    expect(mapBunkoStatus("dropped").skip).toBe(true);
  });
});

describe("mapBunkoRating", () => {
  test("passes through 0–10 strings including 0 and decimals", () => {
    expect(mapBunkoRating("8.5")).toBe("8.5");
    expect(mapBunkoRating("0")).toBe("0");
    expect(mapBunkoRating(10)).toBe("10");
  });

  test("empty / missing → null", () => {
    expect(mapBunkoRating("")).toBeNull();
    expect(mapBunkoRating(null)).toBeNull();
    expect(mapBunkoRating(undefined)).toBeNull();
  });
});

describe("mapBunkoToCatalogRow / RatingRow", () => {
  test("maps a watched movie", () => {
    const cat = mapBunkoToCatalogRow({ name: " Inception ", type: "Movies", status: "watched", rating: "9" }, "English");
    expect(cat).toEqual({
      skip: false,
      value: {
        title: "Inception",
        type: "movie",
        language: "English",
        seasons: null,
        release_status: "released",
        tags: "",
      },
    });
    const rating = mapBunkoToRatingRow({ name: " Inception ", type: "Movies", status: "watched", rating: "9" });
    expect(rating).toEqual({
      skip: false,
      value: {
        title: "Inception",
        rating: "9",
        infinity: false,
        shitty: false,
        recommendation: null,
        review: "",
        progress_status: "watched",
        dropped_at_season: null,
        dropped_at_episode: null,
      },
    });
  });

  test("maps watchlist show with empty rating", () => {
    const rating = mapBunkoToRatingRow({ name: "The Bear", type: "Shows", status: "watchlist", rating: "" });
    expect(rating.skip).toBe(false);
    if (!rating.skip) {
      expect(rating.value.progress_status).toBe("watch_later");
      expect(rating.value.rating).toBeNull();
    }
  });

  test("ignores poster (not in mapped rows)", () => {
    const cat = mapBunkoToCatalogRow(
      { name: "Dune", type: "movies", status: "Watched", rating: "8.5", poster: "https://example.com/p.jpg" },
      "English"
    );
    expect(cat.skip).toBe(false);
    if (!cat.skip) {
      expect("poster" in cat.value).toBe(false);
    }
  });
});

describe("mapBunkoRows", () => {
  test("collects catalog + ratings and per-row map errors", () => {
    const { catalog, ratings, mapErrors } = mapBunkoRows(
      [
        { name: "Good", type: "Movies", status: "watched", rating: "7" },
        { name: "BadType", type: "anime", status: "watched", rating: "5" },
        { name: "BadStatus", type: "Shows", status: "dropped", rating: "3" },
      ],
      "English"
    );
    expect(catalog).toHaveLength(1);
    expect(ratings).toHaveLength(1);
    expect(mapErrors).toHaveLength(2);
    expect(catalog[0].title).toBe("Good");
  });
});
