import { describe, expect, test } from "bun:test";
import { Redis } from "@upstash/redis";
import type { Ratelimit } from "./ratelimit";
import { RegionRatelimit } from "./single";
import type { Algorithm, RegionContext } from "./types";

const limit = 10;

const newRegion = (
  limiter: Algorithm<RegionContext>,
  dynamicLimits = false
): Ratelimit<RegionContext> =>
  new RegionRatelimit({
    prefix: crypto.randomUUID(),
    redis: Redis.fromEnv(),
    limiter,
    dynamicLimits,
    ephemeralCache: new Map(),
  });

const consume = async (ratelimit: Ratelimit<RegionContext>, identifier: string) => {
  for (let index = 0; index < 3; index++) {
    const { pending } = await ratelimit.limit(identifier);
    await pending;
  }
};

const remainingOf = async (ratelimit: Ratelimit<RegionContext>, identifier: string) => {
  const { remaining } = await ratelimit.getRemaining(identifier);
  return remaining;
};

const algorithms: [string, () => Algorithm<RegionContext>][] = [
  ["fixedWindow", () => RegionRatelimit.fixedWindow(limit, "30s")],
  ["slidingWindow", () => RegionRatelimit.slidingWindow(limit, "30s")],
  ["tokenBucket", () => RegionRatelimit.tokenBucket(limit, "30s", limit)],
  ["cachedFixedWindow", () => RegionRatelimit.cachedFixedWindow(limit, "30s")],
];

for (const [name, limiter] of algorithms) {
  describe(`identifiers with ${name}`, () => {
    test("reset only applies to the given identifier", async () => {
      const ratelimit = newRegion(limiter());
      await consume(ratelimit, "user");
      await consume(ratelimit, "user:1");

      for (const identifier of ["*", "use?", "[u]ser", "u*", "user:*", "use"]) {
        await ratelimit.resetUsedTokens(identifier);
      }
      expect(await remainingOf(ratelimit, "user")).toBe(limit - 3);
      expect(await remainingOf(ratelimit, "user:1")).toBe(limit - 3);

      await ratelimit.resetUsedTokens("user");
      expect(await remainingOf(ratelimit, "user")).toBe(limit);
      expect(await remainingOf(ratelimit, "user:1")).toBe(limit - 3);
    }, 20_000);

    test("reset works for identifiers with special characters", async () => {
      const ratelimit = newRegion(limiter());

      for (const identifier of ["user*", "user?[1]", String.raw`user\1`, "2001:db8::1"]) {
        await consume(ratelimit, identifier);
        expect(await remainingOf(ratelimit, identifier)).toBe(limit - 3);

        await ratelimit.resetUsedTokens(identifier);
        expect(await remainingOf(ratelimit, identifier)).toBe(limit);
      }
    }, 20_000);

    test("reset keeps the dynamic limit", async () => {
      const ratelimit = newRegion(limiter(), true);
      await ratelimit.setDynamicLimit({ limit: 5 });

      for (const identifier of ["*", "dynamic", "dynamic:*"]) {
        await ratelimit.resetUsedTokens(identifier);
      }

      expect(await ratelimit.getDynamicLimit()).toEqual({ dynamicLimit: 5 });
    }, 20_000);

    test("reserved identifiers are rejected", async () => {
      const ratelimit = newRegion(limiter(), true);
      await ratelimit.setDynamicLimit({ limit: 5 });

      for (const identifier of [
        "dynamic:global",
        "denyList:all",
        "denyList:ipDenyList",
        "ipDenyListStatus",
        `events:${Date.now()}`,
        ["dynamic:global"] as unknown as string,
      ]) {
        await expect(ratelimit.limit(identifier)).rejects.toThrow("reserved");
        await expect(ratelimit.getRemaining(identifier)).rejects.toThrow("reserved");
        await expect(ratelimit.resetUsedTokens(identifier)).rejects.toThrow("reserved");
      }

      expect(await ratelimit.getDynamicLimit()).toEqual({ dynamicLimit: 5 });
      for (const identifier of ["user", "dynamic", "denyList", "events", "events:signup"]) {
        const { success } = await ratelimit.limit(identifier);
        expect(success).toBe(true);
      }
    }, 20_000);
  });
}
