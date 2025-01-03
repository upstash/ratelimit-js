import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createClient } from "redis";
import type { Ratelimit } from "./ratelimit";
import { RegionRatelimit } from "./single";
import type { Algorithm, Context, RegionContext } from "./types";

const limit = 10;
const refillRate = 10;
const windowString = "30s";

const redis = createClient({
  url: process.env.REDIS_URL ?? "redis://localhost:6379",
});

function newRegion(
  limiter: Algorithm<RegionContext>
): Ratelimit<RegionContext> {
  return new RegionRatelimit({
    prefix: crypto.randomUUID(),
    redis,
    limiter,
  });
}

function run<TContext extends Context>(builder: Ratelimit<TContext>) {
  const id = crypto.randomUUID();

  describe("resetUsedTokens", () => {
    test("reset the tokens", async () => {
      // Consume tokens until the remaining tokens are either equal to 2 or lesser than that
      for (let i = 0; i < 15; i++) {
        await builder.limit(id);
      }

      // reset tokens
      await builder.resetUsedTokens(id);
      const { remaining } = await builder.getRemaining(id);
      expect(remaining).toBe(limit);
    }, 10_000);
  });
}

describe("resetUsedTokens", () => {
  beforeAll(async () => {
    await redis.connect();
  });

  afterAll(async () => {
    await redis.quit();
  });

  describe("fixedWindow", () => {
    describe("region", () =>
      run(newRegion(RegionRatelimit.fixedWindow(limit, windowString))));
  });

  describe("slidingWindow", () => {
    describe("region", () =>
      run(newRegion(RegionRatelimit.slidingWindow(limit, windowString))));
  });

  describe("tokenBucket", () => {
    describe("region", () =>
      run(
        newRegion(RegionRatelimit.tokenBucket(refillRate, windowString, limit))
      ));
  });

  describe("cachedFixedWindow", () => {
    describe("region", () =>
      run(newRegion(RegionRatelimit.cachedFixedWindow(limit, windowString))));
  });
});
