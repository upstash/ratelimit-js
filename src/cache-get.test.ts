import { describe, expect, test } from "bun:test";

import { Cache } from "./cache";

/**
 * `EphemeralCache.get` returns `number | null`: a stored number must come back
 * unchanged and only a missing key may produce null. The cachedFixedWindow
 * algorithm keys off `typeof cache.get(key) === "number"`, so a stored zero
 * read back as null turns a local cache hit into a Redis round trip.
 */
describe("Cache.get", () => {
  test("returns a stored zero as a number, not null", () => {
    const cache = new Cache(new Map());
    cache.set("key", 0);

    expect(cache.get("key")).toBe(0);
    expect(typeof cache.get("key")).toBe("number");
  });

  test("returns null for a missing key", () => {
    const cache = new Cache(new Map());

    expect(cache.get("missing")).toBeNull();
  });

  test("returns other stored numbers unchanged", () => {
    const cache = new Cache(new Map());
    cache.set("positive", 5);
    cache.set("negative", -2);

    expect(cache.get("positive")).toBe(5);
    expect(cache.get("negative")).toBe(-2);
  });
});
