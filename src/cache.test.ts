import { expect, test } from "bun:test";
import { Redis } from "@upstash/redis";
import { Ratelimit } from "./index";

test("ephemeral cache", async () => {
  const maxTokens = 10;
  const redis = Redis.fromEnv();
  await redis.scriptFlush()

  const metrics: Record<string | symbol, number> = {};

  const spy = new Proxy(redis, {
    get: (target, prop) => {
      if (metrics[prop] === undefined) {
        metrics[prop] = 0;
      }
      metrics[prop]++;
      // @ts-expect-error - we don't care about the types here
      return target[prop];
    },
  });
  const ratelimit = new Ratelimit({
    redis: spy,
    limiter: Ratelimit.tokenBucket(maxTokens, "5 s", maxTokens),
    ephemeralCache: new Map(),
  });

  let passes = 0;

  const reasons: (string | undefined)[] = []
  for (let i = 0; i <= 20; i++) {
    const { success, reason } = await ratelimit.limit("id");
    if (success) {
      passes++;
    } else {
      reasons.push(reason)
    }
  }

  expect(passes).toBeLessThanOrEqual(10);
  expect(metrics.evalsha).toBe(12);
  expect(reasons).toContain("cacheBlock")

  await new Promise((r) => setTimeout(r, 5000));
}, 10_000);
