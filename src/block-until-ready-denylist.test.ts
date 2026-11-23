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

describe("blockUntilReady with a deny-list response", () => {
  test("returns the denied response when reset is 0", async () => {
    const id = crypto.randomUUID();
    const ratelimit = build(id);

    const result = await ratelimit.blockUntilReady(id, 50);

    expect(result.success).toBe(false);
    expect(result.reason).toBe("denyList");
    expect(result.deniedValue).toBe(id);
  });
});
