import { Redis } from "https://deno.land/x/upstash_redis/mod.ts";
import { Ratelimit } from "./ratelimiter.ts";
import { assertEquals } from "https://deno.land/std@0.136.0/testing/asserts.ts";
import { TestHarness } from "./test_utils.ts";
import type { Ratelimiter } from "./types.ts";
function assertBetween(n: number, interval: [number, number]): void {
  assertEquals(n >= interval[0], true, `${n} is lower than ${interval[0]}`);
  assertEquals(n <= interval[1], true, `${n} is larger than ${interval[1]}`);
}

type TestCase = {
  // allowed per second
  rate: number;
  /**
   * Multilier for rate
   *
   * rate = 10, load = 0.5 -> attack rate will be 5
   */
  load: number;

  expected: [number, number];
};
const attackDuration = 10;

const testcases: TestCase[] = [
  // 50% Load
  {
    rate: 10,
    load: 0.5,
    expected: [50, 50],
  },
  {
    rate: 100,
    load: 0.5,
    expected: [500, 500],
  },
  {
    rate: 1000,
    load: 0.5,
    expected: [5000, 5000],
  },

  // 100% Load
  {
    rate: 10,
    load: 1.0,
    expected: [90, 100],
  },
  {
    rate: 100,
    load: 1.0,
    expected: [900, 1000],
  },
  {
    rate: 1000,
    load: 1.0,
    expected: [9000, 10000],
  },
  // 150% Load
  {
    rate: 10,
    load: 1.5,
    expected: [90, 100],
  },
  {
    rate: 100,
    load: 1.5,
    expected: [900, 1050],
  },
  {
    rate: 1000,
    load: 1.5,
    expected: [9000, 10500],
  },
];

async function run(
  t: Deno.TestContext,
  limiter: (tc: TestCase) => Ratelimiter,
) {
  for (const tc of testcases) {
    await t.step(
      `Allowed rate: ${tc.rate.toString().padStart(4, " ")}/s - Load: ${
        (
          tc.load * 100
        )
          .toString()
          .padStart(3, " ")
      }% -> Sending ${
        (tc.rate * tc.load)
          .toString()
          .padStart(4, " ")
      }req/s`,
      async () => {
        const h = new TestHarness(
          new Ratelimit({
            redis: Redis.fromEnv(),
            limiter: limiter(tc),
          }),
        );
        await h.attack(tc.rate * tc.load, attackDuration);
        assertBetween(h.metrics.success, tc.expected);
      },
    );
  }
}

Deno.test("TokenBucket", async (t) => {
  await run(t, (tc) => Ratelimit.tokenBucket("1 s", tc.rate, tc.rate));
});

// Deno.test("SlidingLogs", async (t) => {
//   await run(t, (tc) => Ratelimit.slidingLogs("1 s", tc.rate));
// });

Deno.test("SlidingWindow", async (t) => {
  await run(t, (tc) => Ratelimit.slidingWindow("1 s", tc.rate));
});

Deno.test("FixedWindow", async (t) => {
  await run(t, (tc) => Ratelimit.fixedWindow("1 s", tc.rate));
});
