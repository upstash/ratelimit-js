import { Ratelimit } from "./index";
import { expect, test } from "@jest/globals";
import { Redis } from "@upstash/redis";

test("ephemeral cache", async () => {
  const maxTokens = 10;
  const redis = Redis.fromEnv();

  const metrics: Record<string | symbol, number> = {};

  const spy = new Proxy(redis, {
    get: (target, prop) => {
      if (typeof metrics[prop] === "undefined") {
        metrics[prop] = 0;
      }
      metrics[prop]++;
      // @ts-ignore - we don't care about the types here
      return target[prop];
    },
  });
  const ratelimit = new Ratelimit({
    // @ts-ignore - we don't care about the types here
    redis: spy,
    limiter: Ratelimit.tokenBucket(maxTokens, "5 s", maxTokens),
    ephemeralCache: new Map(),
  });

  let passes = 0;

  for (let i = 0; i <= 20; i++) {
    const { success } = await ratelimit.limit("id");
    if (success) {
      passes++;
    }
  }

  expect(passes).toBeLessThanOrEqual(10);
  expect(metrics.eval).toBeLessThanOrEqual(10);

  await new Promise((r) => setTimeout(r, 5000));
}, 10000);
