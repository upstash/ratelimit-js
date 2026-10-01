import { describe, expect, test } from "bun:test";
import {
  isUnsupportedShebangFlagError,
  safeEval,
  stripLuaShebang,
} from "./hash";
import { SCRIPTS } from "./lua-scripts/hash";
import type { RegionContext } from "./types";

const ossShebangError = new Error(
  "ERR Unexpected flag in script shebang: allow-key-locking",
);

describe("safeEval OSS Redis compatibility", () => {
  test("retries without shebang when the server rejects allow-key-locking", async () => {
    const evalCalls: string[] = [];
    const ctx = {
      prefix: "compat-test",
      redis: {
        evalsha: async () => {
          throw new Error("NOSCRIPT No matching script. Please use EVAL.");
        },
        eval: async (script: string) => {
          evalCalls.push(script);
          if (script.startsWith("#!")) {
            throw ossShebangError;
          }
          return [9, 10];
        },
      } as unknown as RegionContext["redis"],
    } as RegionContext;

    const result = await safeEval(
      ctx,
      SCRIPTS.singleRegion.fixedWindow.limit,
      ["key"],
      [10, 10, 1],
    );

    expect(result).toEqual([9, 10]);
    expect(evalCalls).toHaveLength(2);
    expect(evalCalls[0]).toContain("allow-key-locking");
    expect(evalCalls[1].startsWith("#!")).toBe(false);
  });

  test("still uses EVALSHA when the server supports the flag", async () => {
    let evalCalls = 0;
    const ctx = {
      prefix: "compat-test",
      redis: {
        evalsha: async () => [9, 10],
        eval: async () => {
          evalCalls += 1;
          return [9, 10];
        },
      } as unknown as RegionContext["redis"],
    } as RegionContext;

    const result = await safeEval(
      ctx,
      SCRIPTS.singleRegion.fixedWindow.limit,
      ["key"],
      [10, 10, 1],
    );

    expect(result).toEqual([9, 10]);
    expect(evalCalls).toBe(0);
  });

  test("stripLuaShebang removes only the first-line shebang", () => {
    expect(stripLuaShebang("#!lua flags=allow-key-locking\nreturn 1")).toBe(
      "return 1",
    );
    expect(isUnsupportedShebangFlagError(ossShebangError)).toBe(true);
    expect(isUnsupportedShebangFlagError(new Error("NOSCRIPT"))).toBe(false);
  });
});
