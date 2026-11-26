import { describe, expect, test } from "bun:test";
import crypto from "node:crypto";
import { RegionRatelimit } from "./single";
import type { Algorithm, RegionContext } from "./types";

describe("blockUntilReady deadline handling", () => {
  test("does not sleep 100ms when limit() already exceeded the timeout", async () => {
    let calls = 0;
    const limiter: Algorithm<RegionContext> = () => ({
      limit: async () => {
        calls++;
        await new Promise((r) => setTimeout(r, 60));
        return {
          success: false,
          limit: 1,
          remaining: 0,
          reset: Date.now() + 60_000,
          pending: Promise.resolve(),
        };
      },
      getRemaining: async () => ({ remaining: 0, reset: 0, limit: 1 }),
      resetTokens: async () => {},
    });

    const ratelimit = new RegionRatelimit({
      prefix: crypto.randomUUID(),
      redis: {} as any,
      limiter,
      enableTelemetry: false,
      ephemeralCache: false,
    });

    const start = Date.now();
    const res = await ratelimit.blockUntilReady(crypto.randomUUID(), 40);
    const elapsed = Date.now() - start;

    expect(res.success).toBe(false);
    expect(calls).toBe(1);
    expect(elapsed).toBeLessThan(120);
  });

  test("caps past-reset fallback sleep at remaining timeout", async () => {
    const limiter: Algorithm<RegionContext> = () => ({
      limit: async () => ({
        success: false,
        limit: 1,
        remaining: 0,
        reset: Date.now() - 10,
        pending: Promise.resolve(),
      }),
      getRemaining: async () => ({ remaining: 0, reset: 0, limit: 1 }),
      resetTokens: async () => {},
    });

    const ratelimit = new RegionRatelimit({
      prefix: crypto.randomUUID(),
      redis: {} as any,
      limiter,
      enableTelemetry: false,
      ephemeralCache: false,
    });

    const start = Date.now();
    const res = await ratelimit.blockUntilReady(crypto.randomUUID(), 30);
    const elapsed = Date.now() - start;

    expect(res.success).toBe(false);
    expect(elapsed).toBeLessThan(80);
  });
});
