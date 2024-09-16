import { describe, expect, test } from "bun:test";
import crypto from "node:crypto";
import { Redis } from "@upstash/redis";
import { Ratelimit } from "./index";

const redis = Redis.fromEnv();

const metrics: Record<string | symbol, number> = {};

const spy = new Proxy(redis, {
  get: (target, prop) => {
    if (metrics[prop] === undefined) {
      metrics[prop] = 0;
    }
    metrics[prop]++;
    // @ts-expect-error TODO: fix this
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
  }, 20_000);

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
  }, 20_000);
});
