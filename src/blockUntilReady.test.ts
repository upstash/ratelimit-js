import { Ratelimit } from "./ratelimiter.ts";
import { assertEquals } from "https://deno.land/std@0.136.0/testing/asserts.ts";
import type { Redis } from "./types.ts";
let counter = 0;

const redis = {
  eval: (_script: string, _keys: string[], _values: unknown[]) => {
    return Promise.resolve(counter++ as unknown);
  },
} as Redis;

const limiter = new Ratelimit({
  redis,
  limiter: Ratelimit.fixedWindow(5, "5 s"),
});

Deno.test("blockUntilReady", async (t) => {
  await t.step("reaching the timeout", async () => {
    counter = 0;
    const id = crypto.randomUUID();

    // Use up all tokens in the current window
    for (let i = 0; i < 15; i++) {
      await limiter.limit(id);
    }

    const start = Date.now();
    const res = await limiter.blockUntilReady(id, 1000);
    assertEquals(res.success, false, "Should not be allowed");
    assertEquals(start + 1000 <= Date.now(), true, "Should be after 1000 ms");
  });

  await t.step("resolving before the timeout", async () => {
    counter = 0;
    const id = crypto.randomUUID();

    // Use up all tokens in the current window
    // for (let i = 0; i < 4; i++) {
    //   await limiter.limit(id);
    // }

    const start = Date.now();
    const res = await limiter.blockUntilReady(id, 1000);
    assertEquals(res.success, true, "Should be allowed");
    assertEquals(start + 1000 >= Date.now(), true, "Should be within 1000 ms");
  });
});
