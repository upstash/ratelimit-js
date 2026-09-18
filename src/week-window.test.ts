import { expect, test } from "bun:test";
import { Redis } from "@upstash/redis";
import { RegionRatelimit } from "./single";

test("a one week window is accepted by redis", async () => {
  const redis = Redis.fromEnv();
  const prefix = `week-window:${crypto.randomUUID()}`;
  const ratelimit = new RegionRatelimit({
    redis,
    prefix,
    limiter: RegionRatelimit.fixedWindow(10, "1 w"),
  });

  const res = await ratelimit.limit("id");
  expect(res.success).toBe(true);

  const [key] = await redis.keys(`${prefix}*`);
  expect(await redis.pttl(key)).toBeGreaterThan(0);
  await redis.del(key);
});
