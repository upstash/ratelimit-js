import { Redis } from "https://deno.land/x/upstash_redis@v1.19.3/mod.ts";
import { Ratelimit } from "./mod.ts";
import { assertEquals } from "https://deno.land/std@0.152.0/testing/asserts.ts";

Deno.test({
  name: "ephemeral cache",
  fn: async (_t) => {
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

    assertEquals(passes <= 10, true, "It should pass 10 times at most");
    assertEquals(
      metrics.eval <= 10,
      true,
      `It should not have called redis every single time, called: ${metrics.eval}`,
    );
  },
});
