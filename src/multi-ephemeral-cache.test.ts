import { describe, expect, test } from "bun:test";
import { MultiRegionRatelimit } from "./multi";

function mockRedis() {
  const calls = { evalsha: 0, eval: 0 };
  let used = 0;
  const evalsha = async () => {
    calls.evalsha += 1;
    used += 1;
    return ["request-id", String(used)];
  };
  return {
    calls,
    redis: { evalsha, eval: evalsha } as never,
  };
}

describe("MultiRegionRatelimit ephemeral cache", () => {
  test("ephemeralCache: false keeps hitting Redis after a rejection", async () => {
    const { calls, redis } = mockRedis();
    const r = new MultiRegionRatelimit({
      prefix: "ephemeral-cache-test",
      redis: [redis],
      limiter: MultiRegionRatelimit.fixedWindow(1, "10 s"),
      ephemeralCache: false,
    });

    // 1 used token of 1: success, then the next request exceeds the limit.
    const first = await r.limit("id");
    expect(first.success).toBe(true);
    const second = await r.limit("id");
    expect(second.success).toBe(false);

    // Caching is disabled, so the next request must be evaluated by Redis,
    // not answered by the local block cache.
    const third = await r.limit("id");
    expect(third.reason).toBeUndefined();
    expect(third.success).toBe(false);
    expect(calls.evalsha).toBe(3);
  });

  test("a provided Map is shared across instances", async () => {
    const { calls, redis } = mockRedis();
    const cache = new Map<string, number>();
    const limiter = MultiRegionRatelimit.fixedWindow(1, "10 s");

    const first = new MultiRegionRatelimit({
      prefix: "ephemeral-cache-test",
      redis: [redis],
      limiter,
      ephemeralCache: cache,
    });
    const second = new MultiRegionRatelimit({
      prefix: "ephemeral-cache-test",
      redis: [redis],
      limiter,
      ephemeralCache: cache,
    });

    await first.limit("id");
    const rejected = await first.limit("id");
    expect(rejected.success).toBe(false);

    // The identifier is now blocked in the shared map.
    const fromSecond = await second.limit("id");
    expect(fromSecond.reason).toBe("cacheBlock");
    expect(fromSecond.success).toBe(false);
    expect(calls.evalsha).toBe(2);
  });
});
