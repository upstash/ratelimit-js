import { describe, expect, test } from "bun:test";
import crypto from "node:crypto";
import { RegionRatelimit } from "./single";

describe("cachedFixedWindow boundary", () => {
  test("request using the last token succeeds on cache hit like on cache miss", async () => {
    // Redis-side counter for the current window; every eval performs the INCR.
    let used = 8;
    const evalsha = async () => {
      used += 1;
      return used;
    };
    const r = new RegionRatelimit({
      prefix: crypto.randomUUID(),
      redis: { evalsha, eval: evalsha } as never,
      limiter: RegionRatelimit.cachedFixedWindow(10, "10 s"),
    });

    // Cache miss: redis counts 9 of 10 used, request passes.
    const first = await r.limit("id");
    expect(first.success).toBe(true);
    expect(first.remaining).toBe(1);

    // Cache hit: local counter goes to 10 — using the last token must succeed,
    // matching the cache-miss path where used == tokens still succeeds.
    const second = await r.limit("id");
    expect(second.success).toBe(true);
    expect(second.remaining).toBe(0);

    // Cache hit past the limit: rejected.
    const third = await r.limit("id");
    expect(third.success).toBe(false);
  });

  test("evicts expired window entries from ephemeralCache across windows", async () => {
    const originalNow = Date.now;
    let now = 1_700_000_000_000;
    Date.now = () => now;

    try {
      let used = 0;
      const evalsha = async () => {
        used += 1;
        return used;
      };
      const cache = new Map<string, number>();
      const r = new RegionRatelimit({
        prefix: crypto.randomUUID(),
        redis: { evalsha, eval: evalsha } as never,
        limiter: RegionRatelimit.cachedFixedWindow(10, "1 s"),
        ephemeralCache: cache,
        analytics: false,
      });

      for (let i = 0; i < 500; i++) {
        const res = await r.limit(`user-${i % 50}`);
        await res.pending;
        if (i % 50 === 49) {
          now += 1000;
          used = 0;
        }
      }

      // Only the 50 identifiers from the final window remain in the cache.
      expect(cache.size).toBe(50);

      // One-off identifiers from past windows are also evicted once a new window starts.
      now += 1000;
      used = 0;
      await r.limit("one-off-latest");
      expect(cache.size).toBe(1);
    } finally {
      Date.now = originalNow;
    }
  });
});
