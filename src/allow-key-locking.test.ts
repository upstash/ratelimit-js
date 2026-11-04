import { afterEach, describe, expect, test } from "bun:test";
import crypto from "node:crypto";

import { safeEval } from "./hash";
import { RESET_SCRIPT, SCRIPTS } from "./lua-scripts/hash";
import { MultiRegionRatelimit } from "./multi";
import { RegionRatelimit } from "./single";
import type { RegionContext } from "./types";

const sha1 = (str: string) => crypto.createHash("sha1").update(str).digest("hex");

const createMockRedis = () => {
  const evalshaCalls: { hash: string; keys: unknown[]; args: unknown[] }[] = [];
  const evalCalls: { script: string; keys: unknown[]; args: unknown[] }[] = [];
  return {
    evalshaCalls,
    evalCalls,
    redis: {
      evalsha: async (hash: string, keys: unknown[], args: unknown[]) => {
        evalshaCalls.push({ hash, keys, args });
        return [1, 10];
      },
      eval: async (script: string, keys: unknown[], args: unknown[]) => {
        evalCalls.push({ script, keys, args });
        return [1, 10];
      },
      addTelemetry: () => {},
    },
  };
};

describe("allowKeyLocking script and hash verification", () => {
  const algorithms = [
    ...Object.entries(SCRIPTS.singleRegion),
    ...Object.entries(SCRIPTS.multiRegion),
  ];

  for (const [algorithm, scripts] of algorithms) {
    describe(`${algorithm}`, () => {
      for (const [method, scriptInfo] of Object.entries(scripts)) {
        test(`${method} has valid scripts and SHA1 hashes`, () => {
          expect(scriptInfo.script.startsWith("#!lua flags=allow-key-locking\n")).toBe(true);
          expect(sha1(scriptInfo.script)).toBe(scriptInfo.hash);

          expect(scriptInfo.noKeyLockingScript).toBeDefined();
          expect(scriptInfo.noKeyLockingHash).toBeDefined();

          expect(scriptInfo.noKeyLockingScript!.includes("allow-key-locking")).toBe(false);
          expect(sha1(scriptInfo.noKeyLockingScript!)).toBe(scriptInfo.noKeyLockingHash!);
        });
      }
    });
  }

  test("RESET_SCRIPT has valid hashes and no key-locking flag", () => {
    expect(RESET_SCRIPT.script.includes("allow-key-locking")).toBe(false);
    expect(sha1(RESET_SCRIPT.script)).toBe(RESET_SCRIPT.hash);
    expect(RESET_SCRIPT.noKeyLockingScript).toBe(RESET_SCRIPT.script);
    expect(RESET_SCRIPT.noKeyLockingHash).toBe(RESET_SCRIPT.hash);
  });
});

describe("allowKeyLocking constructor wiring", () => {
  afterEach(() => {
    delete process.env.UPSTASH_DISABLE_KEY_LOCKING;
    delete process.env.UPSTASH_ALLOW_KEY_LOCKING;
  });

  test("RegionRatelimit defaults allowKeyLocking to true", () => {
    const { redis } = createMockRedis();
    const ratelimit = new RegionRatelimit({
      redis: redis as never,
      limiter: RegionRatelimit.fixedWindow(10, "10 s"),
    });

    // Access protected ctx
    const ctx = (ratelimit as unknown as { ctx: RegionContext }).ctx;
    expect(ctx.allowKeyLocking).toBe(true);
  });

  test("RegionRatelimit respects allowKeyLocking: false", () => {
    const { redis } = createMockRedis();
    const ratelimit = new RegionRatelimit({
      redis: redis as never,
      limiter: RegionRatelimit.fixedWindow(10, "10 s"),
      allowKeyLocking: false,
    });

    const ctx = (ratelimit as unknown as { ctx: RegionContext }).ctx;
    expect(ctx.allowKeyLocking).toBe(false);
  });

  test("RegionRatelimit respects UPSTASH_DISABLE_KEY_LOCKING=1", () => {
    process.env.UPSTASH_DISABLE_KEY_LOCKING = "1";
    const { redis } = createMockRedis();
    const ratelimit = new RegionRatelimit({
      redis: redis as never,
      limiter: RegionRatelimit.fixedWindow(10, "10 s"),
    });

    const ctx = (ratelimit as unknown as { ctx: RegionContext }).ctx;
    expect(ctx.allowKeyLocking).toBe(false);
  });

  test("RegionRatelimit respects UPSTASH_ALLOW_KEY_LOCKING=false", () => {
    process.env.UPSTASH_ALLOW_KEY_LOCKING = "false";
    const { redis } = createMockRedis();
    const ratelimit = new RegionRatelimit({
      redis: redis as never,
      limiter: RegionRatelimit.fixedWindow(10, "10 s"),
    });

    const ctx = (ratelimit as unknown as { ctx: RegionContext }).ctx;
    expect(ctx.allowKeyLocking).toBe(false);
  });

  test("explicit allowKeyLocking takes precedence over environment variable", () => {
    process.env.UPSTASH_DISABLE_KEY_LOCKING = "1";
    const { redis } = createMockRedis();
    const ratelimit = new RegionRatelimit({
      redis: redis as never,
      limiter: RegionRatelimit.fixedWindow(10, "10 s"),
      allowKeyLocking: true,
    });

    const ctx = (ratelimit as unknown as { ctx: RegionContext }).ctx;
    expect(ctx.allowKeyLocking).toBe(true);
  });

  test("MultiRegionRatelimit respects allowKeyLocking: false", () => {
    const { redis } = createMockRedis();
    const ratelimit = new MultiRegionRatelimit({
      redis: [redis as never],
      limiter: MultiRegionRatelimit.fixedWindow(10, "10 s"),
      allowKeyLocking: false,
    });

    const ctx = (
      ratelimit as unknown as {
        ctx: { allowKeyLocking?: boolean; regionContexts: RegionContext[] };
      }
    ).ctx;
    expect(ctx.allowKeyLocking).toBe(false);
    expect(ctx.regionContexts[0].allowKeyLocking).toBe(false);
  });
});

describe("safeEval key-locking behavior", () => {
  const script = SCRIPTS.singleRegion.fixedWindow.limit;

  test("calls evalsha with script.hash when allowKeyLocking is true", async () => {
    const { redis, evalshaCalls } = createMockRedis();
    const ctx: RegionContext = {
      prefix: "test",
      redis: redis as never,
      allowKeyLocking: true,
    };

    await safeEval(ctx, script, ["key"], [10, 1000, 1]);
    expect(evalshaCalls).toHaveLength(1);
    expect(evalshaCalls[0].hash).toBe(script.hash);
  });

  test("calls evalsha with script.noKeyLockingHash when allowKeyLocking is false", async () => {
    const { redis, evalshaCalls } = createMockRedis();
    const ctx: RegionContext = {
      prefix: "test",
      redis: redis as never,
      allowKeyLocking: false,
    };

    await safeEval(ctx, script, ["key"], [10, 1000, 1]);
    expect(evalshaCalls).toHaveLength(1);
    expect(evalshaCalls[0].hash).toBe(script.noKeyLockingHash!);
  });

  test("falls back to eval with noKeyLockingScript when NOSCRIPT and allowKeyLocking is false", async () => {
    const evalCalls: string[] = [];
    const ctx: RegionContext = {
      prefix: "test",
      allowKeyLocking: false,
      redis: {
        evalsha: async () => {
          throw new Error("NOSCRIPT No matching script");
        },
        eval: async (s: string) => {
          evalCalls.push(s);
          return [1, 10];
        },
      } as never,
    };

    await safeEval(ctx, script, ["key"], [10, 1000, 1]);
    expect(evalCalls).toHaveLength(1);
    expect(evalCalls[0]).toBe(script.noKeyLockingScript!);
    expect(evalCalls[0].includes("allow-key-locking")).toBe(false);
  });

  test("recovers from open-source Redis shebang error and updates ctx.allowKeyLocking", async () => {
    const evalCalls: string[] = [];
    const ctx: RegionContext = {
      prefix: "test",
      allowKeyLocking: true,
      redis: {
        evalsha: async () => {
          throw new Error("NOSCRIPT No matching script");
        },
        eval: async (s: string) => {
          if (s.includes("allow-key-locking")) {
            throw new Error("ERR Unexpected flag in script shebang: allow-key-locking");
          }
          evalCalls.push(s);
          return [1, 10];
        },
      } as never,
    };

    // First call: eval fails with shebang error, falls back to noKeyLockingScript
    const result = await safeEval(ctx, script, ["key"], [10, 1000, 1]);
    expect(result).toEqual([1, 10]);
    expect(evalCalls).toHaveLength(1);
    expect(evalCalls[0]).toBe(script.noKeyLockingScript!);
    expect(ctx.allowKeyLocking).toBe(false);

    // Second call: now that ctx.allowKeyLocking is false, it uses noKeyLockingHash
    let secondHash = "";
    ctx.redis.evalsha = async (h: string) => {
      secondHash = h;
      return [2, 10];
    };
    const secondResult = await safeEval(ctx, script, ["key"], [10, 1000, 1]);
    expect(secondResult).toEqual([2, 10]);
    expect(secondHash).toBe(script.noKeyLockingHash!);
  });

  test("RegionRatelimit limit works end-to-end with allowKeyLocking: false", async () => {
    const { redis, evalshaCalls } = createMockRedis();
    const ratelimit = new RegionRatelimit({
      redis: redis as never,
      limiter: RegionRatelimit.fixedWindow(10, "10 s"),
      allowKeyLocking: false,
    });

    const res = await ratelimit.limit("user1");
    expect(res.success).toBe(true);
    expect(evalshaCalls).toHaveLength(1);
    expect(evalshaCalls[0].hash).toBe(SCRIPTS.singleRegion.fixedWindow.limit.noKeyLockingHash!);
  });
});
