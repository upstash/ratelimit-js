import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { log } from "node:console";
import crypto from "node:crypto";
import { createClient } from "redis";
import type { Algorithm } from ".";
import type { Duration } from "./duration";
import type { Ratelimit } from "./ratelimit";
import { RegionRatelimit } from "./single";
import { TestHarness } from "./test_utils";
import type { Context, RegionContext } from "./types";

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

function run<TContext extends Context>(
  builder: (tc: TestCase) => Ratelimit<TContext>
) {
  for (const tc of testcases) {
    const name = `${tc.rps.toString().padStart(4, " ")}/s - Load: ${(
      tc.load * 100
    )
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
          await harness
            .attack(tc.rps * tc.load, attackDuration, tc.rate)
            .catch((error) => {
              console.error(error);
            });
          log(
            "success:",
            harness.metrics.success,
            ", blocked:",
            harness.metrics.rejected,
            "out of:",
            harness.metrics.requests
          );

          expect(harness.metrics.success).toBeLessThanOrEqual(limits.lte);
          expect(harness.metrics.success).toBeGreaterThanOrEqual(limits.gte);
        },
        attackDuration * 1000 * 4
      );
    });
  }
}

describe("ratelimit", () => {
  beforeAll(async () => {
    await redis.connect();
  });

  afterAll(async () => {
    await redis.quit();
  });

  describe("timeout", () => {
    test("pass after timeout", async () => {
      const r = new RegionRatelimit({
        prefix: crypto.randomUUID(),
        redis: {
          ...redis,
          evalSha: () => new Promise((r) => setTimeout(r, 2000)),
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
        newRegion(
          RegionRatelimit.fixedWindow(tc.rps * (tc.rate ?? 1), windowString)
        )
      ));
  });
  describe("slidingWindow", () => {
    describe("region", () =>
      run((tc) =>
        newRegion(
          RegionRatelimit.slidingWindow(tc.rps * (tc.rate ?? 1), windowString)
        )
      ));
  });

  describe("tokenBucket", () => {
    describe("region", () =>
      run((tc) =>
        newRegion(
          RegionRatelimit.tokenBucket(
            tc.rps,
            windowString,
            tc.rps * (tc.rate ?? 1)
          )
        )
      ));
  });

  describe("cachedFixedWindow", () => {
    describe("region", () =>
      run((tc) =>
        newRegion(
          RegionRatelimit.cachedFixedWindow(
            tc.rps * (tc.rate ?? 1),
            windowString
          )
        )
      ));
  });
});
