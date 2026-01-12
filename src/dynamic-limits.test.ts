import { Redis } from "@upstash/redis";
import { describe, expect, test } from "bun:test";
import crypto from "node:crypto";
import { Ratelimit } from "./index";
import type { Algorithm, RatelimitResponseType, RegionContext } from "./types";

const redis = Redis.fromEnv();

type ExpectedResult = {
  /**
   * Expected limit value in response
   */
  limit: number;
  /**
   * Expected remaining tokens after consuming requestCount
   */
  remaining: number;
  /**
   * Whether requests should succeed
   */
  success: boolean;
  /**
   * Expected result from getDynamicLimit()
   */
  dynamicLimit: number | null;
};

type TestCase = {
  name: string;
  /**
   * Default limit configured in limiter
   */
  defaultLimit: number;
  /**
   * Number of requests to make
   */
  requestCount: number;
  /**
   * Whether dynamicLimits is enabled
   */
  dynamicLimitsEnabled: boolean;
  /**
   * Dynamic limit to set (null means don't call setDynamicLimit)
   */
  setDynamicLimit: number | null;
  /**
   * Expected results after consuming requestCount requests
   */
  expected: ExpectedResult;
};

const testCases: TestCase[] = [
  // Case 1: dynamicLimits: true, setDynamicLimit called
  {
    name: "dynamicLimits enabled, dynamic limit set (lower than default)",
    defaultLimit: 10,
    requestCount: 3,
    dynamicLimitsEnabled: true,
    setDynamicLimit: 3,
    expected: {
      limit: 3,
      remaining: 0,
      success: true, // 3 requests with limit 3 should succeed
      dynamicLimit: 3,
    },
  },
  {
    name: "dynamicLimits enabled, dynamic limit set (exceeds limit)",
    defaultLimit: 10,
    requestCount: 5,
    dynamicLimitsEnabled: true,
    setDynamicLimit: 3,
    expected: {
      limit: 3,
      remaining: 0,
      success: false, // 5 requests with limit 3 should fail
      dynamicLimit: 3,
    },
  },
  // Case 2: dynamicLimits: true, setDynamicLimit not called
  {
    name: "dynamicLimits enabled, no dynamic limit set (uses default)",
    defaultLimit: 10,
    requestCount: 5,
    dynamicLimitsEnabled: true,
    setDynamicLimit: null,
    expected: {
      limit: 10,
      remaining: 5,
      success: true, // 5 requests with default limit 10 should succeed
      dynamicLimit: null,
    },
  },
  // Case 3: dynamicLimits: false, setDynamicLimit not called
  {
    name: "dynamicLimits disabled, no dynamic limit (uses default)",
    defaultLimit: 10,
    requestCount: 5,
    dynamicLimitsEnabled: false,
    setDynamicLimit: null,
    expected: {
      limit: 10,
      remaining: 5,
      success: true, // 5 requests with default limit 10 should succeed
      dynamicLimit: null,
    },
  },
];

function run(
  limiterName: string,
  limiterBuilder: (limit: number) => Algorithm<RegionContext>
) {
  describe(limiterName, () => {
    // Test error cases
    test("should throw error when setDynamicLimit called with dynamicLimits disabled", async () => {
      const ratelimit = new Ratelimit({
        redis,
        limiter: limiterBuilder(10),
        prefix: crypto.randomUUID(),
      });

      await expect(async () => {
        await ratelimit.setDynamicLimit({ limit: 100 });
      }).toThrow("dynamicLimits must be enabled");
    });

    test("should throw error when getDynamicLimit called with dynamicLimits disabled", async () => {
      const ratelimit = new Ratelimit({
        redis,
        limiter: limiterBuilder(10),
        prefix: crypto.randomUUID(),
      });

      await expect(async () => {
        await ratelimit.getDynamicLimit();
      }).toThrow("dynamicLimits must be enabled");
    });

    // Test all cases
    for (const tc of testCases) {
      test(tc.name, async () => {
        const prefix = crypto.randomUUID();
        const ratelimit = new Ratelimit({
          redis,
          limiter: limiterBuilder(tc.defaultLimit),
          prefix,
          dynamicLimits: tc.dynamicLimitsEnabled,
          ephemeralCache: false, // Disable cache for accurate testing
        });

        const identifier = crypto.randomUUID();

        // Set dynamic limit if specified
        if (tc.setDynamicLimit !== null) {
          await ratelimit.setDynamicLimit({ limit: tc.setDynamicLimit });
        }

        // Verify getDynamicLimit before making requests
        if (tc.dynamicLimitsEnabled) {
          const { dynamicLimit } = await ratelimit.getDynamicLimit();
          expect(dynamicLimit).toBe(tc.expected.dynamicLimit);
        }

        // Make requests using rate parameter
        const result = await ratelimit.limit(identifier, { rate: tc.requestCount });

        // Verify result
        expect(result.success).toBe(tc.expected.success);
        expect(result.limit).toBe(tc.expected.limit);
        expect(result.remaining).toBe(tc.expected.remaining);

        // Verify getDynamicLimit after request
        if (tc.dynamicLimitsEnabled) {
          const { dynamicLimit } = await ratelimit.getDynamicLimit();
          expect(dynamicLimit).toBe(tc.expected.dynamicLimit);
        }

        // Verify getRemaining after request
        const finalRemaining = await ratelimit.getRemaining(identifier);
        expect(finalRemaining.limit).toBe(tc.expected.limit);
        expect(finalRemaining.remaining).toBe(tc.expected.remaining);
      });
    }

    // Test ephemeral cache behavior with dynamic limits
    const cacheTestCases = [
      {
        name: "with cache enabled - should block via cache after dynamic limit is removed",
        ephemeralCache: undefined, // undefined means cache is enabled by default
        expectedSecondCallSuccess: false,
        expectedSecondCallReason: "cacheBlock" as RatelimitResponseType | undefined,
      },
      {
        name: "with cache disabled - behavior after dynamic limit is removed",
        ephemeralCache: false as const,
        expectedSecondCallSuccess: undefined, // Will vary by algorithm
        expectedSecondCallReason: undefined as RatelimitResponseType | undefined,
      },
    ] as const;

    for (const cacheTest of cacheTestCases) {
      test(cacheTest.name, async () => {
        const prefix = crypto.randomUUID();
        const ratelimit = new Ratelimit({
          redis,
          limiter: limiterBuilder(10), // default limit: 10
          prefix,
          dynamicLimits: true,
          ephemeralCache: cacheTest.ephemeralCache,
        });

        const identifier = crypto.randomUUID();

        // Set dynamic limit to 3 (lower than default 10)
        await ratelimit.setDynamicLimit({ limit: 3 });

        // Make a request with rate=5, which exceeds dynamic limit (3) but not default (10)
        const firstResult = await ratelimit.limit(identifier, { rate: 5 });
        
        // First call should fail due to dynamic limit
        expect(firstResult.success).toBe(false);
        expect(firstResult.limit).toBe(3);
        expect(firstResult.remaining).toBe(0);

        // Remove the dynamic limit
        await ratelimit.setDynamicLimit({ limit: false });

        // Verify dynamic limit is removed
        const { dynamicLimit } = await ratelimit.getDynamicLimit();
        expect(dynamicLimit).toBeNull();

        // Second call behavior depends on cache setting
        const secondResult = await ratelimit.limit(identifier);
        if (cacheTest.expectedSecondCallReason) {
          expect(secondResult.reason).toBe(cacheTest.expectedSecondCallReason);
        } else {
          expect(secondResult.reason).toBeUndefined();
        }
        
        if (cacheTest.expectedSecondCallSuccess === undefined) {
          // When cache is disabled, behavior differs by algorithm
          if (limiterName === "tokenBucket") {
            // tokenBucket still fails because it has 0 tokens stored and needs refill time
            expect(secondResult.success).toBe(false);
            expect(secondResult.limit).toBe(10);
            expect(secondResult.remaining).toBe(0);
          } else {
            // fixedWindow/slidingWindow succeed because they track used tokens
            expect(secondResult.success).toBe(true);
            expect(secondResult.limit).toBe(10);
            expect(secondResult.remaining).toBe(4); // 10 - 5 (first) - 1 (second) = 4
          }
        } else {
          expect(secondResult.success).toBe(cacheTest.expectedSecondCallSuccess);
        }
        
        if (cacheTest.expectedSecondCallSuccess === false && cacheTest.expectedSecondCallReason === "cacheBlock") {
          // Cache block case - no other checks needed
        }
      });
    }
  });
}

describe("Dynamic Limits", () => {
  run("fixedWindow", (limit) => Ratelimit.fixedWindow(limit, "1000 s"));
  run("slidingWindow", (limit) => Ratelimit.slidingWindow(limit, "1000 s"));
  run("tokenBucket", (limit) => Ratelimit.tokenBucket(limit, "1000 s", limit));
});
