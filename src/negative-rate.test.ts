import { describe, expect, test } from "bun:test";
import { Redis } from "@upstash/redis";
import { MultiRegionRatelimit } from "./multi";
import type { Ratelimit } from "./ratelimit";
import { RegionRatelimit } from "./single";
import type { Algorithm, Context, MultiRegionContext, RegionContext } from "./types";

const limit = 10;
const windowString = "2d";

function run<TContext extends Context>(builder: Ratelimit<TContext>) {
  describe("negative rate", () => {
    test("limit with negative rate, then getRemaining", async () => {
      const id = crypto.randomUUID();
      const negativeRate = -3;
      const limitResult = await builder.limit(id, { rate: negativeRate });
      expect(limitResult.success).toBe(true);
      expect(limitResult.remaining).toBe(limit + Math.abs(negativeRate));

      const remainingResult = await builder.getRemaining(id);
      expect(remainingResult.remaining).toBe(limit + Math.abs(negativeRate));
    });

    test("limit with positive then negative rate, then getRemaining", async () => {
      const id = crypto.randomUUID();
      const positiveRate = 4;
      const negativeRate = -2;
      await builder.limit(id, { rate: positiveRate });
      await builder.limit(id, { rate: negativeRate });
      const remainingResult = await builder.getRemaining(id);
      expect(remainingResult.remaining).toBe(limit - positiveRate + Math.abs(negativeRate));
    });
  });
}

function newRegion(limiter: Algorithm<RegionContext>): Ratelimit<RegionContext> {
  return new RegionRatelimit({
    prefix: crypto.randomUUID(),
    redis: Redis.fromEnv({ enableAutoPipelining: true }),
    limiter,
  });
}

function ensureEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Environment variable ${key} not found`);
  }
  return value;
}

function newMultiRegion(limiter: Algorithm<MultiRegionContext>): Ratelimit<MultiRegionContext> {
  return new MultiRegionRatelimit({
    prefix: crypto.randomUUID(),
    redis: [
      new Redis({
        url: ensureEnv("EU2_UPSTASH_REDIS_REST_URL"),
        token: ensureEnv("EU2_UPSTASH_REDIS_REST_TOKEN"),
        enableAutoPipelining: true
      }),
      new Redis({
        url: ensureEnv("APN_UPSTASH_REDIS_REST_URL"),
        token: ensureEnv("APN_UPSTASH_REDIS_REST_TOKEN"),
        enableAutoPipelining: true
      }),
      new Redis({
        url: ensureEnv("US1_UPSTASH_REDIS_REST_URL"),
        token: ensureEnv("US1_UPSTASH_REDIS_REST_TOKEN"),
        enableAutoPipelining: true
      }),
    ],
    limiter,
  });
}

describe("fixedWindow", () => {
  describe("region", () => run(newRegion(RegionRatelimit.fixedWindow(limit, windowString))));
  describe("multiRegion", () => run(newMultiRegion(MultiRegionRatelimit.fixedWindow(limit, windowString))));
});

describe("slidingWindow", () => {
  describe("region", () => run(newRegion(RegionRatelimit.slidingWindow(limit, windowString))));
  describe("multiRegion", () => run(newMultiRegion(MultiRegionRatelimit.slidingWindow(limit, windowString))));
});

describe("tokenBucket", () => {
  describe("region", () => run(newRegion(RegionRatelimit.tokenBucket(limit, windowString, limit))));
});

describe("cachedFixedWindow", () => {
  describe("region", () => run(newRegion(RegionRatelimit.cachedFixedWindow(limit, windowString))));
});
