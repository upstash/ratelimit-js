import { afterAll, describe, expect, test } from "bun:test";
import { Redis } from "@upstash/redis";
import { ms } from "./duration";
import { RegionRatelimit } from "./single";

// The "w" unit produces expire values of a week or more in milliseconds.
// Every algorithm hands that number to PEXPIRE inside Lua, so run each one
// against a live database and check the resulting TTL to make sure Redis
// accepts it.

const week = ms("1 w");
const redis = Redis.fromEnv({ enableAutoPipelining: true });
const prefix = `week-window-test:${crypto.randomUUID()}`;

const algorithms = [
  { name: "fixedWindow", limiter: RegionRatelimit.fixedWindow(10, "1 w") },
  { name: "slidingWindow", limiter: RegionRatelimit.slidingWindow(10, "1 w") },
  { name: "tokenBucket", limiter: RegionRatelimit.tokenBucket(10, "1 w", 10) },
  // cachedFixedWindow is not covered here: its Lua script never calls PEXPIRE
  // (it compares the INCRBY result to a string), so the key has no TTL for any
  // window size. That is a separate bug from the week unit.
];

afterAll(async () => {
  const keys = await redis.keys(`${prefix}*`);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
});

describe("one week window", () => {
  for (const { name, limiter } of algorithms) {
    test(`${name} sets a week-long expire`, async () => {
      const ratelimit = new RegionRatelimit({ redis, prefix: `${prefix}:${name}`, limiter });
      const id = crypto.randomUUID();

      const res = await ratelimit.limit(id);
      await res.pending;

      expect(res.success).toBe(true);
      expect(res.reset).toBeGreaterThan(Date.now());
      expect(res.reset).toBeLessThanOrEqual(Date.now() + week);

      const keys = await redis.keys(`${prefix}:${name}:${id}*`);
      expect(keys.length).toBeGreaterThan(0);
      for (const key of keys) {
        const ttl = await redis.pttl(key);
        // Sliding window keeps keys for two windows plus a second.
        expect(ttl).toBeGreaterThan(0);
        expect(ttl).toBeLessThanOrEqual(week * 2 + 1000);
      }
    });
  }
});
