import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import crypto from "node:crypto";
import { createClient } from "redis";
import { Ratelimit } from "./index";

const redis = createClient({
  url: process.env.REDIS_URL ?? "redis://localhost:6379",
});

const metrics: Record<string | symbol, number> = {};

const spy = new Proxy(redis, {
  get: (target, prop) => {
    if (metrics[prop] === undefined) {
      metrics[prop] = 0;
    }
    metrics[prop]++;
    // @ts-expect-error we don't care about the types here
    return target[prop].bind(target);
  },
});

const limiter = new Ratelimit({
  redis: spy,
  limiter: Ratelimit.fixedWindow(5, "5 s"),
});

describe("blockUntilReady", () => {
  beforeAll(async () => {
    await redis.connect();
  });

  afterAll(async () => {
    await redis.quit();
  });

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
  }, 20_000);
});
