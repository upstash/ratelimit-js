import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import type { Redis } from "@upstash/redis";

import { MultiRegionRatelimit } from "./multi";
import { RegionRatelimit } from "./single";

const LIMIT_ERROR = "ERR max requests limit exceeded. Limit: 500000, Usage: 500000";

const fail = () => Promise.reject(new Error(LIMIT_ERROR));

const createFailingRedis = () => ({ evalsha: fail, eval: fail }) as unknown as Redis;

describe("failOpen", () => {
  let warn: ReturnType<typeof spyOn>;

  beforeEach(() => {
    warn = spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
  });

  test("allows the request when redis returns an error", async () => {
    const ratelimit = new RegionRatelimit({
      redis: createFailingRedis(),
      limiter: RegionRatelimit.fixedWindow(1, "10 s"),
      enableTelemetry: false,
    });

    const res = await ratelimit.limit("id");

    expect(res.success).toBe(true);
    expect(res.limit).toBe(0);
    expect(res.remaining).toBe(0);
    expect(res.reset).toBe(0);
    expect(res.reason).toBe("error");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(`${warn.mock.calls[0][1]}`).toContain(LIMIT_ERROR);
  });

  test("allows the request when every region returns an error", async () => {
    const ratelimit = new MultiRegionRatelimit({
      redis: [createFailingRedis(), createFailingRedis()],
      limiter: MultiRegionRatelimit.fixedWindow(1, "10 s"),
    });

    const res = await ratelimit.limit("id");

    expect(res.success).toBe(true);
    expect(res.reason).toBe("error");
  });

  test("blockUntilReady returns once the check fails", async () => {
    const ratelimit = new RegionRatelimit({
      redis: createFailingRedis(),
      limiter: RegionRatelimit.slidingWindow(1, "10 s"),
      enableTelemetry: false,
    });

    const res = await ratelimit.blockUntilReady("id", 1000);

    expect(res.success).toBe(true);
    expect(res.reason).toBe("error");
  });

  test("throws the error when failOpen is false", async () => {
    const ratelimit = new RegionRatelimit({
      redis: createFailingRedis(),
      limiter: RegionRatelimit.tokenBucket(1, "10 s", 1),
      failOpen: false,
      enableTelemetry: false,
    });

    await expect(ratelimit.limit("id")).rejects.toThrow(LIMIT_ERROR);
    expect(warn).not.toHaveBeenCalled();
  });
});
