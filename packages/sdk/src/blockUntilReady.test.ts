import { Ratelimit } from "./index";
import { test, expect, describe } from "@jest/globals";
import { Redis } from "@upstash/redis";
import crypto from "node:crypto";

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

describe("blockUntilReady", () => {
  test("reaching the timeout", async () => {
    const id = crypto.randomUUID();

    // Use up all tokens in the current window
    for (let i = 0; i < 15; i++) {
      await limiter.limit(id);
    }

    const start = Date.now();
    const res = await limiter.blockUntilReady(id, 1200);
    expect(res.success).toBe(false);
    expect(start + 1000).toBeLessThanOrEqual(Date.now());
    await res.pending;
  }, 20000);

  test("resolving before the timeout", async () => {
    const id = crypto.randomUUID();

    // Use up all tokens in the current window
    // for (let i = 0; i < 4; i++) {
    //   await limiter.limit(id);
    // }

    const start = Date.now();
    const res = await limiter.blockUntilReady(id, 1000);
    expect(res.success).toBe(true);
    expect(start + 1000).toBeGreaterThanOrEqual(Date.now());

    await res.pending;
  }, 20000);
});
