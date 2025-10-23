import { describe, expect, test } from "bun:test";
import { log } from "node:console";
import crypto from "node:crypto";
import { Redis } from "@upstash/redis";
import type { Algorithm } from ".";
import type { Duration } from "./duration";
import { MultiRegionRatelimit } from "./multi";
import type { Ratelimit } from "./ratelimit";
import { RegionRatelimit } from "./single";
import { TestHarness } from "./test_utils";
import type { Context, MultiRegionContext, RegionContext } from "./types";

type TestCase = {
  /**
   * Limit allowed during window
   */
  limit: number;
  /**
   * Request load
   * 
   * E.g., 0.5 means 50% of the limit in each window will be consumed,
   * so all requests will succeed (assuming rate=1)
   * 
   * E.g., 2 means 200% of the limit in each window will be consumed,
   * so half of the requests will be rejected (assuming rate=1)
   */
  load: number;
  /**
   * rate at which the tokens will be added or consumed
   */
  rate: number;
};
const attackDuration = 8;
const window = 4;
const windowString: Duration = `${window} s`;

const testcases: TestCase[] = [];

for (const limit of [16]) {
  for (const load of [0.8, 1.6]) {
    for (const rate of [1, 3]) {
      testcases.push({ load, limit, rate });
    }
  }
}

function run<TContext extends Context>(
  builder: (tc: TestCase) => Ratelimit<TContext>
) {
  for (const tc of testcases) {

    const windowCount = attackDuration / window;
    /**
     * Total number of requests sent during the attack
     */
    const attackRequestCount = windowCount * tc.limit * tc.load;
    /**
     * Number of requests the simulated attacker shall attempt
     */
    const attackRequestPerSecond = attackRequestCount / attackDuration;
    /**
     * Maximum number of requests that can be allowed per second
     */
    const maxSuccessRequestCount = windowCount * tc.limit / tc.rate;
    /**
     * Number of successful requests expected during the attack
     */
    const expectedSuccessRequestCount = Number.parseFloat(Math.min(maxSuccessRequestCount, attackRequestCount).toFixed(2));

    const limits = {
      lte: Number.parseFloat((expectedSuccessRequestCount * 1.5).toFixed(2)),
      gte: Number.parseFloat((expectedSuccessRequestCount * 0.5).toFixed(2)),
    };

    const name = `${tc.limit} Limit, ${tc.load * 100}% Load, ${attackRequestPerSecond} req/s (with rate=${tc.rate})`;
    const range = `Range:  ${limits.gte} - ${limits.lte} Success`
    
    const ratelimit = builder(tc);

    describe(name, () => {
      test(
        range,
        async () => {
          log();
          log(`  Config: ${name}`);
          log(`  ${range} (Expected: ${expectedSuccessRequestCount})`);
          const harness = new TestHarness(ratelimit);
          await harness
            .attack(attackRequestPerSecond, attackDuration, tc.rate)
            .catch((error) => {
              console.error(error);
            });
          log(
            `  Result: success: ${harness.metrics.success}, blocked: ${harness.metrics.rejected} (out of: ${harness.metrics.requests})`
          );

          expect(harness.metrics.success).toBeLessThanOrEqual(limits.lte);
          expect(harness.metrics.success).toBeGreaterThanOrEqual(limits.gte);
        },
        attackDuration * 1000 * 4
      );
    });
  }
}

function newMultiRegion(
  limiter: Algorithm<MultiRegionContext>
): Ratelimit<MultiRegionContext> {
  // eslint-disable-next-line unicorn/consistent-function-scoping
  function ensureEnv(key: string): string {
    const value = process.env[key];
    if (!value) {
      throw new Error(`Environment variable ${key} not found`);
    }
    return value;
  }

  return new MultiRegionRatelimit({
    prefix: crypto.randomUUID(),
    redis: [
      new Redis({
        url: ensureEnv("EU2_UPSTASH_REDIS_REST_URL"),
        token: ensureEnv("EU2_UPSTASH_REDIS_REST_TOKEN"),
      }),
      new Redis({
        url: ensureEnv("APN_UPSTASH_REDIS_REST_URL"),
        token: ensureEnv("APN_UPSTASH_REDIS_REST_TOKEN"),
      }),
      new Redis({
        url: ensureEnv("US1_UPSTASH_REDIS_REST_URL"),
        token: ensureEnv("US1_UPSTASH_REDIS_REST_TOKEN"),
      }),
    ],
    limiter,
  });
}

function newRegion(
  limiter: Algorithm<RegionContext>
): Ratelimit<RegionContext> {
  return new RegionRatelimit({
    prefix: crypto.randomUUID(),
    redis: Redis.fromEnv(),
    limiter,
  });
}

describe("timeout", () => {
  test("pass after timeout", async () => {
    const r = new RegionRatelimit({
      prefix: crypto.randomUUID(),
      redis: {
        ...Redis.fromEnv(),
        evalsha: () => new Promise((r) => setTimeout(r, 2000)),
      },
      limiter: RegionRatelimit.fixedWindow(1, "1 s"),
      timeout: 1000,
    });
    const start = Date.now();
    const res = await r.limit("id");
    const duration = Date.now() - start;
    expect(res.success).toBe(true);
    expect(res.limit).toBe(0);
    expect(res.remaining).toBe(0);
    expect(res.reset).toBe(0);
    expect(res.reason).toBe("timeout");
    expect(duration).toBeGreaterThanOrEqual(900);
    expect(duration).toBeLessThanOrEqual(1100);

    // stop the test from leaking
    await new Promise((r) => setTimeout(r, 5000));
  }, 10_000);
});

describe("fixedWindow", () => {
  describe("region", () =>
    run((tc) =>
      newRegion(RegionRatelimit.fixedWindow(tc.limit, windowString))
    ));

  describe("multiRegion", () =>
    run((tc) =>
      newMultiRegion(
        MultiRegionRatelimit.fixedWindow(tc.limit, windowString)
      )
    ));
});
describe("slidingWindow", () => {
  describe("region", () =>
    run((tc) =>
      newRegion(RegionRatelimit.slidingWindow(tc.limit, windowString))
    ));
  describe("multiRegion", () =>
    run((tc) =>
      newMultiRegion(
        MultiRegionRatelimit.slidingWindow(tc.limit, windowString)
      )
    ));
});

describe("tokenBucket", () => {
  describe("region", () =>
    run((tc) =>
      newRegion(
        RegionRatelimit.tokenBucket(tc.limit, windowString, tc.limit)
      )
    ));
});

describe("cachedFixedWindow", () => {
  describe("region", () =>
    run((tc) =>
      newRegion(
        RegionRatelimit.cachedFixedWindow(tc.limit, windowString)
      )
    ));
});
