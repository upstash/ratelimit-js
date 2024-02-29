import { describe, expect, test } from "bun:test";
import { Redis } from "@upstash/redis";
import { Ratelimit } from "./index";

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

const limit = 10;
const identifier = "12.0.0.1";

const limiter = new Ratelimit({
  redis: spy,
  limiter: Ratelimit.fixedWindow(limit, "5 s"),
});

describe("resetUsedTokens", () => {
  test("reset the tokens", async () => {
    // Consume tokens until the remaining tokens are either equal to 2 or lesser than that
    for (let i = 0; i < 15; i++) {
      await limiter.limit(identifier);
    }

    // reset tokens
    await limiter.resetUsedTokens(identifier);
    setTimeout(async () => {
      const { remaining } = await limiter.limit(identifier);
      expect(remaining).toBe(limit - 1);
    }, 2000);
  }, 20000);
});
