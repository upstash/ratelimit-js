import { describe, expect, test } from "bun:test";
import crypto from "node:crypto";
import { RegionRatelimit } from "./single";
import type { Algorithm, RatelimitResponse, RegionContext } from "./types";

/**
 * A deny-list hit is returned with `reset: 0` because there is no window to
 * wait for. `blockUntilReady` must hand that response back to the caller
 * instead of treating `reset: 0` as an impossible state and throwing.
 */
function build(deniedValue: string) {
  const response = (): RatelimitResponse => ({
    success: false,
    limit: 0,
    remaining: 0,
    reset: 0,
    pending: Promise.resolve(),
    reason: "denyList",
    deniedValue,
  });

  const limiter: Algorithm<RegionContext> = () => ({
    limit: async () => response(),
    getRemaining: async () => ({ remaining: 0, reset: 0, limit: 0 }),
    resetTokens: async () => {},
  });

  return new RegionRatelimit({
    prefix: crypto.randomUUID(),
    redis: {} as any,
    limiter,
    enableTelemetry: false,
    ephemeralCache: false,
  });
}

/**
 * Builds a ratelimit with protection enabled. The stubbed redis reports every
 * member as denied, so the first call goes through the real deny list check
 * and later calls are answered from the deny list cache.
 */
function buildWithProtection() {
  let denyListChecks = 0;

  const limiter: Algorithm<RegionContext> = () => ({
    // rate limited with a window that only resets in an hour
    limit: async () => ({
      success: false,
      limit: 1,
      remaining: 0,
      reset: Date.now() + 3_600_000,
      pending: Promise.resolve(),
    }),
    getRemaining: async () => ({ remaining: 0, reset: 0, limit: 1 }),
    resetTokens: async () => {},
  });

  const redis = {
    eval: async (_script: string, _keys: string[], members: string[]) => {
      denyListChecks++;
      return [members.map(() => true), 1];
    },
  };

  const ratelimit = new RegionRatelimit({
    prefix: crypto.randomUUID(),
    redis: redis as any,
    limiter,
    enableProtection: true,
    enableTelemetry: false,
    ephemeralCache: false,
  });

  return { ratelimit, getDenyListChecks: () => denyListChecks };
}

describe("blockUntilReady with a deny-list response", () => {
  test("returns the first denial without waiting for the window", async () => {
    const id = crypto.randomUUID();
    const { ratelimit, getDenyListChecks } = buildWithProtection();

    const start = Date.now();
    const result = await ratelimit.blockUntilReady(id, 3000);

    expect(result.success).toBe(false);
    expect(result.reason).toBe("denyList");
    expect(result.deniedValue).toBe(id);
    expect(Date.now() - start).toBeLessThan(1000);
    expect(getDenyListChecks()).toBe(1);
  });

  test("returns the cached denial without waiting or throwing", async () => {
    const id = crypto.randomUUID();
    const { ratelimit, getDenyListChecks } = buildWithProtection();

    await ratelimit.blockUntilReady(id, 3000);

    const start = Date.now();
    const result = await ratelimit.blockUntilReady(id, 3000);

    expect(result.success).toBe(false);
    expect(result.reason).toBe("denyList");
    expect(result.deniedValue).toBe(id);
    expect(result.reset).toBe(0);
    expect(Date.now() - start).toBeLessThan(1000);
    // answered from the cache, redis is not asked again
    expect(getDenyListChecks()).toBe(1);
  });

  test("returns the denied response when reset is 0", async () => {
    const id = crypto.randomUUID();
    const ratelimit = build(id);

    const result = await ratelimit.blockUntilReady(id, 50);

    expect(result.success).toBe(false);
    expect(result.reason).toBe("denyList");
    expect(result.deniedValue).toBe(id);
  });
});
