import { Redis } from "@upstash/redis";
import { describe, expect, test } from "bun:test";
import crypto from "node:crypto";
import { RegionRatelimit } from "./single";

describe("cachedFixedWindow expiry", () => {
  for (const rate of [1, 5]) {
    test(`the counter key expires with its window (rate ${rate})`, async () => {
      const redis = Redis.fromEnv();
      const prefix = `cached-fixed-window-ttl:${crypto.randomUUID()}`;
      const ratelimit = new RegionRatelimit({
        redis,
        prefix,
        limiter: RegionRatelimit.cachedFixedWindow(10, "10 s"),
      });

      const res = await ratelimit.limit("id", { rate });
      expect(res.success).toBe(true);

      const [key] = await redis.keys(`${prefix}*`);
      const ttl = await redis.pttl(key);
      await redis.del(key);
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(10_000);
    });
  }
});

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
});
