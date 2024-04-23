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
  // requests per second
  rps: number;
  /**
   * Multiplier for rate
   *
   * rate = 10, load = 0.5 -> attack rate will be 5
   */
  load: number;
  /**
   * rate at which the tokens will be added or consumed, default should be 1
   * @default 1
   */
  rate?: number;
};
const attackDuration = 10;
const window = 5;
const windowString: Duration = `${window} s`;

const testcases: TestCase[] = [];

for (const rps of [10, 100]) {
  for (const load of [0.5, 0.7]) {
    for (const rate of [undefined, 10]) {
      testcases.push({ load, rps, rate });
    }
  }
}

function run<TContext extends Context>(builder: (tc: TestCase) => Ratelimit<TContext>) {
  for (const tc of testcases) {
    const name = `${tc.rps.toString().padStart(4, " ")}/s - Load: ${(tc.load * 100)
      .toString()
      .padStart(3, " ")}% -> Sending ${(tc.rps * tc.load)
      .toString()
      .padStart(4, " ")}req/s at the rate of ${tc.rate ?? 1}`;
    const ratelimit = builder(tc);

    const limits = {
      lte: ((attackDuration * tc.rps * (tc.rate ?? 1)) / window) * 1.5,
      gte: ((attackDuration * tc.rps) / window) * 0.5,
    };
    describe(name, () => {
      test(
        `should be within ${limits.gte} - ${limits.lte}`,
        async () => {
          log(name);
          const harness = new TestHarness(ratelimit);
          await harness.attack(tc.rps * tc.load, attackDuration, tc.rate).catch((e) => {
            console.error(e);
          });
          log(
            "success:",
            harness.metrics.success,
            ", blocked:",
            harness.metrics.rejected,
            "out of:",
            harness.metrics.requests,
          );

          expect(harness.metrics.success).toBeLessThanOrEqual(limits.lte);
          expect(harness.metrics.success).toBeGreaterThanOrEqual(limits.gte);
        },
        attackDuration * 1000 * 4,
      );
    });
  }
}

function newMultiRegion(limiter: Algorithm<MultiRegionContext>): Ratelimit<MultiRegionContext> {
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

function newRegion(limiter: Algorithm<RegionContext>): Ratelimit<RegionContext> {
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
      // @ts-ignore - I just want to test the timeout
      redis: {
        ...Redis.fromEnv(),
        eval: () => new Promise((r) => setTimeout(r, 2000)),
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
    expect(duration).toBeGreaterThanOrEqual(900);
    expect(duration).toBeLessThanOrEqual(1100);

    // stop the test from leaking
    await new Promise((r) => setTimeout(r, 5000));
  }, 10000);
});

describe("fixedWindow", () => {
  describe("region", () =>
    run((tc) => newRegion(RegionRatelimit.fixedWindow(tc.rps * (tc.rate ?? 1), windowString))));

  describe("multiRegion", () =>
    run((tc) =>
      newMultiRegion(MultiRegionRatelimit.fixedWindow(tc.rps * (tc.rate ?? 1), windowString)),
    ));
});
describe("slidingWindow", () => {
  describe("region", () =>
    run((tc) => newRegion(RegionRatelimit.slidingWindow(tc.rps * (tc.rate ?? 1), windowString))));
  describe("multiRegion", () =>
    run((tc) =>
      newMultiRegion(MultiRegionRatelimit.slidingWindow(tc.rps * (tc.rate ?? 1), windowString)),
    ));
});

describe("tokenBucket", () => {
  describe("region", () =>
    run((tc) =>
      newRegion(RegionRatelimit.tokenBucket(tc.rps, windowString, tc.rps * (tc.rate ?? 1))),
    ));
});

describe("cachedFixedWindow", () => {
  describe("region", () =>
    run((tc) =>
      newRegion(RegionRatelimit.cachedFixedWindow(tc.rps * (tc.rate ?? 1), windowString)),
    ));
});
