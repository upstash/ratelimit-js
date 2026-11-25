import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { createHash } from "node:crypto";
import { buildScript, isScriptFlagError, scriptHash } from "./hash";
import { RESET_SCRIPT, SCRIPTS } from "./lua-scripts/hash";
import { MultiRegionRatelimit } from "./multi";
import { RegionRatelimit } from "./single";
import { VERSION } from "./version";

const sha1 = (script: string) => createHash("sha1").update(script).digest("hex");

type Call = { command: "evalsha" | "eval"; arg: string };

const SHEBANG_ERROR = "ERR Unexpected flag in script shebang: allow-key-locking";

/**
 * Mock redis which doesn't have any script loaded. With `rejectFlags`, it acts
 * like self-hosted Redis and rejects scripts with a shebang.
 */
const mockRedis = (calls: Call[], { rejectFlags = false } = {}) =>
  ({
    evalsha: async (hash: string) => {
      calls.push({ command: "evalsha", arg: hash });
      throw new Error("NOSCRIPT No matching script");
    },
    eval: async (script: string) => {
      calls.push({ command: "eval", arg: script });
      if (rejectFlags && script.startsWith("#!")) throw new Error(SHEBANG_ERROR);
      return [1, 10];
    },
  }) as any;

const limitScript = SCRIPTS.singleRegion.fixedWindow.limit;
const flagged = buildScript(limitScript, true);
const plain = buildScript(limitScript, false);

const createLimiter = (calls: Call[], upstashScriptFlags?: boolean, rejectFlags = false) =>
  new RegionRatelimit({
    redis: mockRedis(calls, { rejectFlags }),
    limiter: RegionRatelimit.fixedWindow(10, "10 s"),
    enableTelemetry: false,
    ephemeralCache: false,
    upstashScriptFlags,
  });

describe("buildScript", () => {
  test("adds script_name and allow-key-locking", () => {
    expect(flagged).toBe(
      `#!lua script_name=ratelimit-typescript-${VERSION}-fixed_window_limit flags=allow-key-locking\n${limitScript.script}`,
    );
    expect(plain).toBe(limitScript.script);
    expect(plain.startsWith("#!")).toBe(false);
  });

  test("leaves allow-key-locking off the reset script", () => {
    expect(buildScript(RESET_SCRIPT, true)).toBe(
      `#!lua script_name=ratelimit-typescript-${VERSION}-reset\n${RESET_SCRIPT.script}`,
    );
  });

  test("script names are unique and fit in the server's 100 byte limit", () => {
    const scripts = [
      ...Object.values(SCRIPTS.singleRegion),
      ...Object.values(SCRIPTS.multiRegion),
    ].flatMap((algorithm) => [algorithm.limit, algorithm.getRemaining]);
    const names = [...scripts, RESET_SCRIPT].map((info) => info.name);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) {
      expect(`ratelimit-typescript-99.99.99-${name}`.length).toBeLessThanOrEqual(100);
    }
  });

  test("scriptHash matches sha1", async () => {
    expect(await scriptHash(flagged)).toBe(sha1(flagged));
    expect(await scriptHash(plain)).toBe(sha1(plain));
  });
});

describe("isScriptFlagError", () => {
  test.each([
    ["ERR Unexpected flag in script shebang: allow-key-locking", true],
    ["ERR Unknown lua shebang option: script_name", true],
    ["ERR Error compiling script (new function): user_script:1: unexpected symbol near '#'", true],
    ["NOSCRIPT No matching script", false],
    ["ERR some other error", false],
  ])("%s", (message, expected) => {
    expect(isScriptFlagError(new Error(message))).toBe(expected);
  });
});

describe("upstashScriptFlags", () => {
  const warn = spyOn(console, "warn").mockImplementation(() => undefined);
  afterEach(() => warn.mockClear());

  test("falls back to EVAL without flags once when unset and the server rejects them", async () => {
    const calls: Call[] = [];
    const ratelimit = createLimiter(calls, undefined, true);

    await ratelimit.limit("id");
    expect(calls).toEqual([
      { command: "evalsha", arg: sha1(flagged) },
      { command: "eval", arg: flagged },
      { command: "eval", arg: plain },
    ]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain("upstashScriptFlags: false");

    // the client is remembered, flags are not sent again
    calls.length = 0;
    await ratelimit.limit("id");
    expect(calls).toEqual([
      { command: "evalsha", arg: sha1(plain) },
      { command: "eval", arg: plain },
    ]);

    // the warning is printed only once
    await createLimiter([], undefined, true).limit("id");
    expect(warn).toHaveBeenCalledTimes(1);
  });

  for (const upstashScriptFlags of [undefined, true]) {
    test(`sends the flags with upstashScriptFlags=${upstashScriptFlags}`, async () => {
      const calls: Call[] = [];
      await createLimiter(calls, upstashScriptFlags).limit("id");
      expect(calls).toEqual([
        { command: "evalsha", arg: sha1(flagged) },
        { command: "eval", arg: flagged },
      ]);
      expect(warn).not.toHaveBeenCalled();
    });
  }

  test("sends no flags with upstashScriptFlags=false", async () => {
    const calls: Call[] = [];
    await createLimiter(calls, false, true).limit("id");
    expect(calls).toEqual([
      { command: "evalsha", arg: sha1(plain) },
      { command: "eval", arg: plain },
    ]);
    expect(warn).not.toHaveBeenCalled();
  });

  test("throws the server error with upstashScriptFlags=true", async () => {
    const calls: Call[] = [];
    const ratelimit = createLimiter(calls, true, true);
    // limit() catches redis errors only with a timeout, so call the script directly
    await expect(ratelimit.getRemaining("id")).rejects.toThrow(SHEBANG_ERROR);
  });

  for (const upstashScriptFlags of [undefined, false]) {
    test(`multi region with upstashScriptFlags=${upstashScriptFlags}`, async () => {
      const calls: Call[] = [];
      const ratelimit = new MultiRegionRatelimit({
        redis: [mockRedis(calls)],
        limiter: MultiRegionRatelimit.fixedWindow(10, "10 s"),
        enableTelemetry: false,
        upstashScriptFlags,
      });
      await ratelimit.limit("id").catch(() => undefined);

      const script = buildScript(SCRIPTS.multiRegion.fixedWindow.limit, upstashScriptFlags !== false);
      expect(calls[0]).toEqual({ command: "evalsha", arg: sha1(script) });
      expect(calls[1]).toEqual({ command: "eval", arg: script });
    });
  }
});
