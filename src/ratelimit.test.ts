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
import { config } from "https://deno.land/x/dotenv@v3.2.0/mod.ts";

config({ export: true });
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
};
const attackDuration = 60;
const window = 5;
const windowString: Duration = `${window} s`;

const testcases: TestCase[] = [];

for (const rate of [10, 100, 200]) {
  for (const load of [0.5, 1.0, 1.5]) {
    testcases.push({ load, rate });
  }
}

async function run<TContext extends Context>(
  t: Deno.TestContext,
  builder: (tc: TestCase) => Ratelimit<TContext>,
) {
  for (const tc of testcases) {
    const ratelimit = builder(tc);

    await t.step(
      `${tc.rate.toString().padStart(4, " ")}/s - Load: ${
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
        await harness.attack(tc.rate * tc.load, attackDuration);
        assertBetween(harness.metrics.success, [
          ((attackDuration * tc.rate) / window) * 0.9,
          ((attackDuration * tc.rate) / window) * 1.1,
        ]);

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

function newGlobal(
  limiter: Algorithm<GlobalContext>,
): Ratelimit<GlobalContext> {
  function ensureEnv(key: string): string {
    const value = Deno.env.get(key);
    if (!value) {
      throw new Error(`Environment variable ${key} not found`);
    }
    return value;
  }

  return new GlobalRatelimit({
    prefix: crypto.randomUUID(),
    redis: [
      new Redis({
        url: ensureEnv("EU2_UPSTASH_REDIS_REST_URL"),
        token: ensureEnv("EU2_UPSTASH_REDIS_REST_TOKEN")!,
      }),
      new Redis({
        url: ensureEnv("APN_UPSTASH_REDIS_REST_URL")!,
        token: ensureEnv("APN_UPSTASH_REDIS_REST_TOKEN")!,
      }),
      new Redis({
        url: ensureEnv("US1_UPSTASH_REDIS_REST_URL")!,
        token: ensureEnv("US1_UPSTASH_REDIS_REST_TOKEN")!,
      }),
    ],
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
    ignore: Deno.env.get("UPSTASH_TEST_ALGORITHM") !== "" &&
      Deno.env.get("UPSTASH_TEST_ALGORITHM") !== "fixedWindow",
  },
  async (t) => {
    await t.step({
      name: "region",
      ignore: Deno.env.get("UPSTASH_TEST_SCOPE") === "global",
      fn: async (t) =>
        await run(
          t,
          (tc) => newRegion(RegionRatelimit.fixedWindow(tc.rate, windowString)),
        ),
    });
    await t.step({
      name: "global",
      sanitizeOps: false,
      sanitizeResources: false,
      ignore: Deno.env.get("UPSTASH_TEST_SCOPE") === "region",
      fn: async (t) =>
        await run(
          t,
          (tc) => newGlobal(GlobalRatelimit.fixedWindow(tc.rate, windowString)),
        ),
    });
  },
);

Deno.test(
  "slidingWindow",
  {
    ignore: Deno.env.get("UPSTASH_TEST_ALGORITHM") !== "" &&
      Deno.env.get("UPSTASH_TEST_ALGORITHM") !== "slidingWindow",
  },
  async (t) => {
    await t.step({
      name: "region",
      ignore: Deno.env.get("UPSTASH_TEST_SCOPE") === "global",
      fn: async (t) =>
        await run(
          t,
          (tc) =>
            newRegion(RegionRatelimit.slidingWindow(tc.rate, windowString)),
        ),
    });
    await t.step({
      name: "global",
      sanitizeOps: false,
      sanitizeResources: false,
      ignore: Deno.env.get("UPSTASH_TEST_SCOPE") === "region",
      fn: async (t) =>
        await run(
          t,
          (tc) =>
            newGlobal(GlobalRatelimit.slidingWindow(tc.rate, windowString)),
        ),
    });
  },
);
Deno.test(
  "tokenBucket",
  {
    ignore: Deno.env.get("UPSTASH_TEST_ALGORITHM") !== "" &&
      Deno.env.get("UPSTASH_TEST_ALGORITHM") !== "tokenBucket",
  },
  async (t) => {
    await t.step({
      name: "region",
      ignore: Deno.env.get("UPSTASH_TEST_SCOPE") === "global",
      fn: async (t) =>
        await run(
          t,
          (tc) =>
            newRegion(
              RegionRatelimit.tokenBucket(tc.rate, windowString, tc.rate),
            ),
        ),
    });
    // await t.step({
    //   name: "global",
    // sanitizeOps:false,
    // sanitizeResources:false,

    //   ignore: Deno.env.get("UPSTASH_TEST_SCOPE") === "region",
    //   fn: async (t) =>
    //     await run(t, (tc) =>
    //       newGlobal(GlobalRatelimit.tokenBucket(tc.rate, windowString, tc.rate))
    //     ),
    // });
  },
);
