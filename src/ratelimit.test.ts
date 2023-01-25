import { Redis } from "https://deno.land/x/upstash_redis@v1.12.0-next.1/mod.ts";
import { Algorithm } from "./mod.ts";
import {
  assert,
  assertAlmostEquals,
  assertEquals,
} from "https://deno.land/std@0.152.0/testing/asserts.ts";
import { TestHarness } from "./test_utils.ts";
import { Ratelimit } from "./ratelimit.ts";
import * as hdr from "https://esm.sh/hdr-histogram-js";
import { RegionRatelimit } from "./single.ts";
import { MultiRegionRatelimit } from "./multi.ts";
import type { Duration } from "./duration.ts";
import type { Context, MultiRegionContext, RegionContext } from "./types.ts";
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
   * Multiplier for rate
   *
   * rate = 10, load = 0.5 -> attack rate will be 5
   */
  load: number;
};
const attackDuration = 60;
const window = 5;
const windowString: Duration = `${window} s`;

const testcases: TestCase[] = [];

for (const rate of [10, 100]) {
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
    const isMultiRegion = ratelimit instanceof MultiRegionRatelimit;
    const tolerance = isMultiRegion ? 0.5 : 0.1;

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
          ((attackDuration * tc.rate) / window) * (1 - tolerance),
          ((attackDuration * tc.rate) / window) * (1 + tolerance),
        ]);

        const h = hdr.build();
        for (const { start, end } of Object.values(harness.latencies)) {
          const latency = end - start;
          h.recordValue(latency);
        }
      },
    );
  }
}

function newMultiRegion(
  limiter: Algorithm<MultiRegionContext>,
): Ratelimit<MultiRegionContext> {
  function ensureEnv(key: string): string {
    const value = Deno.env.get(key);
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

Deno.test("timeout", async (t) => {
  await t.step({
    name: "pass after timeout",
    fn: async () => {
      const r = new RegionRatelimit({
        prefix: crypto.randomUUID(),
        // @ts-ignore - I just want to test the timeout
        redis: { eval: () => new Promise((r) => setTimeout(r, 2000)) } as Redis,
        limiter: RegionRatelimit.fixedWindow(1, "1 s"),
        timeout: 1000,
      });
      const start = Date.now();
      const res = await r.limit("id");
      const duration = Date.now() - start;
      assertEquals(res.success, true);
      assertEquals(res.limit, 0);
      assertEquals(res.remaining, 0);
      assertEquals(res.reset, 0);
      assertAlmostEquals(duration, 1000, 100);

      // stop the test from leaking
      await new Promise((r) => setTimeout(r, 5000));
    },
  });
});

Deno.test("fixedWindow", async (t) => {
  await t.step({
    name: "region",
    fn: async (t) =>
      await run(
        t,
        (tc) => newRegion(RegionRatelimit.fixedWindow(tc.rate, windowString)),
      ),
  });
  await t.step({
    name: "multiRegion",

    fn: async (t) =>
      await run(
        t,
        (tc) =>
          newMultiRegion(
            MultiRegionRatelimit.fixedWindow(tc.rate, windowString),
          ),
      ),
  });
});

Deno.test("slidingWindow", async (t) => {
  await t.step({
    name: "region",
    fn: async (t) =>
      await run(
        t,
        (tc) => newRegion(RegionRatelimit.slidingWindow(tc.rate, windowString)),
      ),
  });
  await t.step({
    name: "multiRegion",

    fn: async (t) =>
      await run(t, (tc) =>
        newMultiRegion(
          MultiRegionRatelimit.slidingWindow(tc.rate, windowString),
        )),
  });
});
Deno.test("tokenBucket", async (t) => {
  await t.step({
    name: "region",
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
  //   name: "multiRegion",
  // sanitizeOps:false,
  // sanitizeResources:false,

  //   ignore: Deno.env.get("UPSTASH_TEST_SCOPE") === "region",
  //   fn: async (t) =>
  //     await run(t, (tc) =>
  //       newMultiRegion(MultiRegionRatelimit.tokenBucket(tc.rate, windowString, tc.rate))
  //     ),
  // });
});
