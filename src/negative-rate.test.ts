import { describe, expect, test } from "bun:test";
import { Redis } from "@upstash/redis";
import { MultiRegionRatelimit } from "./multi";
import type { Ratelimit } from "./ratelimit";
import { RegionRatelimit } from "./single";
import type {
  Algorithm,
  Context,
  MultiRegionContext,
  RegionContext,
} from "./types";

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
      expect(remainingResult.remaining).toBe(
        limit - positiveRate + Math.abs(negativeRate)
      );
    });

    test("refund when at limit", async () => {
      const id = crypto.randomUUID();

      // Consume entire limit
      const consumeResult = await builder.limit(id, { rate: limit });
      expect(consumeResult.success).toBe(true);
      expect(consumeResult.remaining).toBe(0);

      await consumeResult.pending;

      // Verify at limit
      const remaining = await builder.getRemaining(id);
      expect(remaining.remaining).toBe(0);

      // Try to refund - should succeed
      const refundResult = await builder.limit(id, { rate: -3 });
      expect(refundResult.success).toBe(true);
      expect(refundResult.remaining).toBe(3);

      await refundResult.pending;

      // Verify refund was applied
      const afterRefund = await builder.getRemaining(id);
      expect(afterRefund.remaining).toBe(3);
    });

    test("refund when over limit", async () => {
      const id = crypto.randomUUID();

      // Consume more than limit
      await builder.limit(id, { rate: limit });
      const overLimit = await builder.limit(id, { rate: 3 });
      expect(overLimit.success).toBe(false);

      // Try to refund - should work
      const refundResult = await builder.limit(id, { rate: -5 });
      expect(refundResult.success).toBe(true);

      // Should have some tokens back
      const afterRefund = await builder.getRemaining(id);
      expect(afterRefund.remaining).toBeGreaterThan(0);
    });

    test("rate = 0 behavior", async () => {
      const id = crypto.randomUUID();

      // Check initial state
      const initial = await builder.getRemaining(id);
      const initialRemaining = initial.remaining;

      // Use rate = 0
      const result = await builder.limit(id, { rate: 0 });
      expect(result.success).toBe(true);

      // Remaining should be unchanged
      const after = await builder.getRemaining(id);
      expect(after.remaining).toBe(initialRemaining);
    });

    test("over-refund (refund more than consumed)", async () => {
      const id = crypto.randomUUID();

      // Consume some tokens
      await builder.limit(id, { rate: 3 });
      const afterConsume = await builder.getRemaining(id);
      expect(afterConsume.remaining).toBe(limit - 3);

      // Refund more than consumed
      const refundResult = await builder.limit(id, { rate: -5 });
      expect(refundResult.success).toBe(true);

      // Should have more than initial limit
      const afterRefund = await builder.getRemaining(id);
      expect(afterRefund.remaining).toBe(limit - 3 + 5);
      expect(afterRefund.remaining).toBeGreaterThan(limit);
    });

    test("very large negative value", async () => {
      const id = crypto.randomUUID();

      // Consume some tokens
      await builder.limit(id, { rate: 2 });

      // Refund with very large negative value
      const largeNegative = -1000;
      const refundResult = await builder.limit(id, { rate: largeNegative });
      expect(refundResult.success).toBe(true);

      // Should have massively increased tokens
      const afterRefund = await builder.getRemaining(id);
      expect(afterRefund.remaining).toBe(limit - 2 + Math.abs(largeNegative));
    });

    test("multiple refunds in sequence", async () => {
      const id = crypto.randomUUID();

      // Consume tokens
      const res = await builder.limit(id, { rate: 8 });
      await res.pending;
      const remaining = await builder.getRemaining(id);
      expect(remaining.remaining).toBe(2);

      // Multiple refunds
      const res2 = await builder.limit(id, { rate: -2 });
      await res2.pending;
      const remaining2 = await builder.getRemaining(id);
      expect(remaining2.remaining).toBe(4);

      const res3 = await builder.limit(id, { rate: -3 });
      await res3.pending;
      const remaining3 = await builder.getRemaining(id);
      expect(remaining3.remaining).toBe(7);

      // Should be able to consume again
      const finalResult = await builder.limit(id, { rate: 5 });
      expect(finalResult.success).toBe(true);
      expect(finalResult.remaining).toBe(2);
    });

    test("refund should clear the ephemeral cache", async () => {
      const id = crypto.randomUUID();

      // Consume MORE than the limit to get cache blocked
      const overLimit = await builder.limit(id, { rate: limit + 1 });
      expect(overLimit.success).toBe(false);

      // Second request should be cache blocked (unless cachedFixedWindow which doesn't use blockUntil)
      const overLimit2 = await builder.limit(id, { rate: 1 });
      expect(overLimit2.success).toBe(false);
      // cachedFixedWindow doesn't use cacheBlock mechanism, so skip this check
      if (overLimit2.reason !== undefined) {
        expect(overLimit2.reason).toBe("cacheBlock");
      }

      // Refund to bring back under limit
      const refundResult = await builder.limit(id, { rate: -5 });
      expect(refundResult.success).toBe(true);

      // Next positive rate request should succeed
      const afterRefund = await builder.limit(id, { rate: 2 });
      expect(afterRefund.success).toBe(true);
      expect(afterRefund.remaining).toBeGreaterThan(0);
    });
  });
}

function newRegion(
  limiter: Algorithm<RegionContext>
): Ratelimit<RegionContext> {
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

function newMultiRegion(
  limiter: Algorithm<MultiRegionContext>
): Ratelimit<MultiRegionContext> {
  return new MultiRegionRatelimit({
    prefix: crypto.randomUUID(),
    redis: [
      new Redis({
        url: ensureEnv("EU2_UPSTASH_REDIS_REST_URL"),
        token: ensureEnv("EU2_UPSTASH_REDIS_REST_TOKEN"),
        enableAutoPipelining: true,
      }),
      new Redis({
        url: ensureEnv("APN_UPSTASH_REDIS_REST_URL"),
        token: ensureEnv("APN_UPSTASH_REDIS_REST_TOKEN"),
        enableAutoPipelining: true,
      }),
      new Redis({
        url: ensureEnv("US1_UPSTASH_REDIS_REST_URL"),
        token: ensureEnv("US1_UPSTASH_REDIS_REST_TOKEN"),
        enableAutoPipelining: true,
      }),
    ],
    limiter,
  });
}

describe("fixedWindow", () => {
  describe("region", () =>
    run(newRegion(RegionRatelimit.fixedWindow(limit, windowString))));
  describe("multiRegion", () =>
    run(newMultiRegion(MultiRegionRatelimit.fixedWindow(limit, windowString))));
});

describe("slidingWindow", () => {
  describe("region", () =>
    run(newRegion(RegionRatelimit.slidingWindow(limit, windowString))));
  describe("multiRegion", () =>
    run(
      newMultiRegion(MultiRegionRatelimit.slidingWindow(limit, windowString))
    ));
});

describe("tokenBucket", () => {
  describe("region", () =>
    run(newRegion(RegionRatelimit.tokenBucket(limit, windowString, limit))));
});

describe("cachedFixedWindow", () => {
  describe("region", () =>
    run(newRegion(RegionRatelimit.cachedFixedWindow(limit, windowString))));
});
