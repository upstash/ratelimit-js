import { describe, expect, test } from "bun:test";
import { DYNAMIC_LIMIT_KEY_SUFFIX } from "./constants";
import { RegionRatelimit } from "./single";
import type { RegionContext } from "./types";

const algorithms = [
  { name: "fixedWindow", create: () => RegionRatelimit.fixedWindow(10, "1 s"), keyCount: 1 },
  { name: "slidingWindow", create: () => RegionRatelimit.slidingWindow(10, "1 s"), keyCount: 2 },
  { name: "tokenBucket", create: () => RegionRatelimit.tokenBucket(10, "1 s", 10), keyCount: 1 },
];

describe("single-region key locking", () => {
  for (const { name, create, keyCount } of algorithms) {
    for (const method of ["limit", "getRemaining"] as const) {
      for (const dynamicLimits of [undefined, false, true]) {
        test(`${name}.${method} with dynamicLimits=${dynamicLimits}`, async () => {
          const calls: string[][] = [];
          const ctx: RegionContext = {
            prefix: "key-locking-test",
            dynamicLimits,
            redis: {
              evalsha: async (_hash: string, keys: string[]) => {
                calls.push(keys);
                return name === "tokenBucket" ? [9, Date.now(), 10] : [9, 10];
              },
            } as unknown as RegionContext["redis"],
          };
          const algorithm = create()();

          await algorithm[method](ctx, "alice");
          await algorithm[method](ctx, "bob");

          expect(calls).toHaveLength(2);
          for (const keys of calls) {
            expect(keys).toHaveLength(keyCount + (dynamicLimits ? 1 : 0));
            expect(keys).not.toContain("");
          }
          const sharedKeys = calls[0].filter((key) => calls[1].includes(key));
          expect(sharedKeys).toEqual(
            dynamicLimits ? [`${ctx.prefix}${DYNAMIC_LIMIT_KEY_SUFFIX}`] : [],
          );
          if (dynamicLimits) {
            for (const keys of calls) {
              expect(keys[keyCount]).toBe(`${ctx.prefix}${DYNAMIC_LIMIT_KEY_SUFFIX}`);
            }
          }
        });
      }
    }
  }
});
