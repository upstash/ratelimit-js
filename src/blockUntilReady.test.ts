import { Ratelimit } from "./mod.ts";
import { assertEquals } from "https://deno.land/std@0.174.0/testing/asserts.ts";
import { Redis } from "https://deno.land/x/upstash_redis@v1.19.3/mod.ts";

const redis = Redis.fromEnv();

const metrics: Record<string | symbol, number> = {};

const spy = new Proxy(redis, {
  get: (target, prop) => {
    if (typeof metrics[prop] === "undefined") {
      metrics[prop] = 0;
    }
    metrics[prop]++;
    // @ts-ignore - we don't care about the types here
    return target[prop];
  },
});
const limiter = new Ratelimit({
  redis: spy,
  limiter: Ratelimit.fixedWindow(5, "5 s"),
});

Deno.test("blockUntilReady", async (t) => {
  await t.step("reaching the timeout", async () => {
    const id = crypto.randomUUID();

    // Use up all tokens in the current window
    for (let i = 0; i < 15; i++) {
      await limiter.limit(id);
    }

    const start = Date.now();
    const res = await limiter.blockUntilReady(id, 1000);
    assertEquals(res.success, false, "Should not be allowed");
    assertEquals(start + 1000 <= Date.now(), true, "Should be after 1000 ms");
    await new Promise((r) => setTimeout(r, 5000));
  });

  await t.step("resolving before the timeout", async () => {
    const id = crypto.randomUUID();

    // Use up all tokens in the current window
    // for (let i = 0; i < 4; i++) {
    //   await limiter.limit(id);
    // }

    const start = Date.now();
    const res = await limiter.blockUntilReady(id, 1000);
    assertEquals(res.success, true, "Should be allowed");
    assertEquals(start + 1000 >= Date.now(), true, "Should be within 1000 ms");
    await new Promise((r) => setTimeout(r, 5000));
  });
});
