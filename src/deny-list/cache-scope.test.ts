import { describe, expect, test } from "bun:test";
import { Ratelimit } from "../index";
import type { Algorithm, RegionContext } from "../types";

// An algorithm that always allows, so the only thing that can deny a request
// is the deny list.
const alwaysAllow: Algorithm<RegionContext> = () => ({
  limit: async () => ({
    success: true,
    limit: 10,
    remaining: 9,
    reset: Date.now() + 10_000,
    pending: Promise.resolve(),
  }),
  getRemaining: async () => ({ remaining: 9, reset: 0, limit: 10 }),
  resetTokens: async () => {},
});

// A redis stub whose deny list holds every value it is asked about.
const redisDenyingEverything = {
  eval: async (_script: string, _keys: string[], members: string[]) => [
    members.map(() => true),
    0,
  ],
  evalsha: async () => {
    throw new Error("not used");
  },
  get: async () => null,
  set: async () => "OK",
} as any;

// A redis stub that would never deny anything.
const redisDenyingNothing = {
  eval: async (_script: string, _keys: string[], members: string[]) => [
    members.map(() => false),
    0,
  ],
  evalsha: async () => {
    throw new Error("not used");
  },
  get: async () => null,
  set: async () => "OK",
} as any;

describe("deny list cache scope", () => {
  test("a value denied under one prefix is not denied under another prefix", async () => {
    const identifier = `scope-prefix-${crypto.randomUUID()}`;

    const protectedLimiter = new Ratelimit({
      redis: redisDenyingEverything,
      limiter: alwaysAllow,
      prefix: "scope-test-a",
      enableProtection: true,
      enableTelemetry: false,
    });
    const otherLimiter = new Ratelimit({
      redis: redisDenyingNothing,
      limiter: alwaysAllow,
      prefix: "scope-test-b",
      enableProtection: true,
      enableTelemetry: false,
    });

    const denied = await protectedLimiter.limit(identifier);
    expect(denied.success).toBe(false);
    expect(denied.reason).toBe("denyList");

    const other = await otherLimiter.limit(identifier);
    expect(other.success).toBe(true);
    expect(other.reason).toBeUndefined();
  });

  test("a limiter without enableProtection ignores values denied by another limiter", async () => {
    const identifier = `scope-protection-${crypto.randomUUID()}`;

    const protectedLimiter = new Ratelimit({
      redis: redisDenyingEverything,
      limiter: alwaysAllow,
      enableProtection: true,
      enableTelemetry: false,
    });
    const unprotectedLimiter = new Ratelimit({
      redis: redisDenyingEverything,
      limiter: alwaysAllow,
      enableTelemetry: false,
    });

    const denied = await protectedLimiter.limit(identifier);
    expect(denied.reason).toBe("denyList");

    const unprotected = await unprotectedLimiter.limit(identifier);
    expect(unprotected.success).toBe(true);
    expect(unprotected.reason).toBeUndefined();
  });

  test("a value denied under a prefix is still served from the cache for that prefix", async () => {
    const identifier = `scope-same-${crypto.randomUUID()}`;
    let evalCalls = 0;
    const countingRedis = {
      ...redisDenyingEverything,
      eval: async (script: string, keys: string[], members: string[]) => {
        evalCalls += 1;
        return redisDenyingEverything.eval(script, keys, members);
      },
    };

    const limiter = new Ratelimit({
      redis: countingRedis,
      limiter: alwaysAllow,
      prefix: "scope-test-same",
      enableProtection: true,
      enableTelemetry: false,
    });

    const first = await limiter.limit(identifier);
    expect(first.reason).toBe("denyList");
    const second = await limiter.limit(identifier);
    expect(second.reason).toBe("denyList");
    // The second call is answered by the in-memory cache without asking redis.
    expect(evalCalls).toBe(1);
  });
});
