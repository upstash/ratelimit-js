import { Redis } from "https://deno.land/x/upstash_redis@v1.3.3/mod.ts";
import { Algorithm } from "./mod.ts";
import { assertEquals } from "https://deno.land/std@0.136.0/testing/asserts.ts";
import { TestHarness } from "./test_utils.ts";
import { Ratelimit } from "./ratelimit.ts";
import * as hdr from "https://esm.sh/hdr-histogram-js";
import { RegionRatelimit } from "./region.ts";
import { GlobalRatelimit } from "./global.ts";
import type { Duration } from "./duration.ts";
import type { Context, GlobalContext, RegionContext } from "./types.ts";

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
const attackDuration = 60;
const window = 5;
const windowString: Duration = `${window} s`;

const testcases: TestCase[] = [
  // 50% Load
  {
    rate: 10,
    load: 0.5,
    expected: [60, 60],
  },
  {
    rate: 100,
    load: 0.5,
    expected: [600, 600],
  },
  {
    rate: 200,
    load: 0.5,
    expected: [1200, 1200],
  },

  // 100% Load
  {
    rate: 10,
    load: 1.0,
    expected: [108, 120],
  },
  {
    rate: 100,
    load: 1.0,
    expected: [1080, 1200],
  },
  {
    rate: 200,
    load: 1.0,
    expected: [2160, 2400],
  },
  // 150% Load
  {
    rate: 10,
    load: 1.5,
    expected: [108, 132],
  },
  {
    rate: 100,
    load: 1.5,
    expected: [1080, 1320],
  },
  {
    rate: 200,
    load: 1.5,
    expected: [2160, 2540],
  },
];

async function run<TContext extends Context>(
  t: Deno.TestContext,
  builder: (tc: TestCase) => Ratelimit<TContext>,
) {
  for (const tc of testcases) {
    const ratelimit = builder(tc);
    const type = ratelimit instanceof GlobalRatelimit ? "GLOBAL" : "REGION";

    await t.step(
      `${type}: Allowed rate: ${
        tc.rate
          .toString()
          .padStart(4, " ")
      }/s - Load: ${
        (tc.load * 100)
          .toString()
          .padStart(3, " ")
      }% -> Sending ${
        (tc.rate * tc.load)
          .toString()
          .padStart(4, " ")
      }req/s`,
      async () => {
        const harness = new TestHarness(ratelimit);
        await harness.attack((tc.rate * tc.load) / window, attackDuration);
        assertBetween(harness.metrics.success, tc.expected);

        const h = hdr.build();
        for (const { start, end } of Object.values(harness.latencies)) {
          const latency = end - start;
          h.recordValue(latency);
        }

        // console.log(h.summary); // { "p50": 123, ... , max: 1244, totalCount: 3 }
      },
    );
  }
}

function _newGlobal(
  limiter: Algorithm<GlobalContext>,
): Ratelimit<GlobalContext> {
  return new GlobalRatelimit({
    redis: [],
    limiter,
  });
}

function newRegion(
  limiter: Algorithm<RegionContext>,
): Ratelimit<RegionContext> {
  return new RegionRatelimit({
    prefix: crypto.randomUUID(),
    redis: Redis.fromEnv(),

    limiter,
  });
}

Deno.test(
  "fixedWindow",
  {
    ignore: Deno.env.get("TEST_ONLY") &&
      Deno.env.get("TEST_ONLY") !== "fixedWindow",
  },
  async (t: Deno.TestContext) => {
    await run(
      t,
      (tc) => newRegion(RegionRatelimit.fixedWindow(tc.rate, windowString)),
    );
  },
);

Deno.test(
  "slidingWindow",
  {
    ignore: Deno.env.get("TEST_ONLY") &&
      Deno.env.get("TEST_ONLY") !== "slidingWindow",
  },
  async (t) => {
    await run(
      t,
      (tc) => newRegion(RegionRatelimit.slidingWindow(tc.rate, windowString)),
    );
  },
);

Deno.test(
  "tokenBucket",
  {
    ignore: Deno.env.get("TEST_ONLY") &&
      Deno.env.get("TEST_ONLY") !== "tokenBucket",
  },
  async (t) => {
    await run(
      t,
      (tc) =>
        newRegion(RegionRatelimit.tokenBucket(tc.rate, windowString, tc.rate)),
    );
  },
);
