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
  describe("getRemainingTokens", () => {
    test(
      "get remaining tokens",
      async () => {
        const id = crypto.randomUUID();
        // Stop at any random request call within the limit
        const stopAt = Math.floor(Math.random() * (limit - 1) + 1);
        for (let i = 1; i <= limit; i++) {
          const [limitResult, remainigResult] = await Promise.all([
            builder.limit(id),
            builder.getRemaining(id),
          ]);

          expect(limitResult.remaining).toBe(remainigResult.remaining);
          expect(limitResult.reset).toBe(remainigResult.reset);
          if (i == stopAt) {
            break;
          }
        }

        const { remaining } = await builder.getRemaining(id);
        expect(remaining).toBe(limit - stopAt);
      },
      {
        timeout: 10_000,
        retry: 3,
      }
    );
  });
}

describe("getRemainingTokens", () => {
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
