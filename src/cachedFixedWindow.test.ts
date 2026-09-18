import { describe, expect, test } from "bun:test";
import crypto from "node:crypto";
import { RegionRatelimit } from "./single";

describe("cachedFixedWindow boundary", () => {
  test("request using the last token succeeds on cache hit like on cache miss", async () => {
    // Redis-side counter for the current window, mirroring the script: reject
    // before incrementing, otherwise increment and report the new count.
    let used = 8;
    const evalsha = async (_hash: string, _keys: string[], args: number[]) => {
      const [, incrementBy, tokens] = args;
      if (incrementBy > 0 && used + incrementBy > tokens) {
        return [used, 0];
      }
      used += incrementBy;
      return [used, 1];
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

    // Cache hit past the limit: rejected locally, nothing sent to redis.
    const third = await r.limit("id");
    expect(third.success).toBe(false);
    expect(third.remaining).toBe(0);
    expect(used).toBe(10);

    // A cold instance sharing the counter: the rejection comes from redis and
    // must roll back, leaving the counter at 10 and reporting 0 remaining.
    const cold = new RegionRatelimit({
      prefix: crypto.randomUUID(),
      redis: { evalsha, eval: evalsha } as never,
      limiter: RegionRatelimit.cachedFixedWindow(10, "10 s"),
    });
    const fourth = await cold.limit("id");
    expect(fourth.success).toBe(false);
    expect(fourth.remaining).toBe(0);
    expect(used).toBe(10);
  });
});
