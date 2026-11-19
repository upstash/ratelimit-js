import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { KEY_LOCKING_SHEBANG, RESET_SCRIPT, SCRIPTS } from "./lua-scripts/hash";
import { MultiRegionRatelimit } from "./multi";
import { RegionRatelimit } from "./single";

const sha1 = (script: string) => createHash("sha1").update(script).digest("hex");

type Call = { command: "evalsha" | "eval"; arg: string };

const mockRedis = (calls: Call[]) =>
  ({
    evalsha: async (hash: string) => {
      calls.push({ command: "evalsha", arg: hash });
      throw new Error("NOSCRIPT No matching script");
    },
    eval: async (script: string) => {
      calls.push({ command: "eval", arg: script });
      return [1, 10];
    },
  }) as any;

describe("keyLocking flag", () => {
  test("hashWithoutKeyLocking matches the script without the shebang", () => {
    const scripts = [
      ...Object.values(SCRIPTS.singleRegion),
      ...Object.values(SCRIPTS.multiRegion),
    ].flatMap((algorithm) => [algorithm.limit, algorithm.getRemaining]);
    for (const info of scripts) {
      expect(info.script.startsWith(KEY_LOCKING_SHEBANG)).toBe(true);
      expect(sha1(info.script)).toBe(info.hash);
      expect(sha1(info.script.slice(KEY_LOCKING_SHEBANG.length))).toBe(info.hashWithoutKeyLocking!);
    }
    expect(sha1(RESET_SCRIPT.script)).toBe(RESET_SCRIPT.hash);
  });

  for (const keyLocking of [undefined, true, false]) {
    test(`single region with keyLocking=${keyLocking}`, async () => {
      const calls: Call[] = [];
      const ratelimit = new RegionRatelimit({
        redis: mockRedis(calls),
        limiter: RegionRatelimit.fixedWindow(10, "10 s"),
        enableTelemetry: false,
        ephemeralCache: false,
        keyLocking,
      });
      await ratelimit.limit("id");

      const info = SCRIPTS.singleRegion.fixedWindow.limit;
      const enabled = keyLocking !== false;
      expect(calls).toEqual([
        { command: "evalsha", arg: enabled ? info.hash : info.hashWithoutKeyLocking! },
        {
          command: "eval",
          arg: enabled ? info.script : info.script.slice(KEY_LOCKING_SHEBANG.length),
        },
      ]);
    });

    test(`multi region with keyLocking=${keyLocking}`, async () => {
      const calls: Call[] = [];
      const ratelimit = new MultiRegionRatelimit({
        redis: [mockRedis(calls)],
        limiter: MultiRegionRatelimit.fixedWindow(10, "10 s"),
        enableTelemetry: false,
        keyLocking,
      });
      await ratelimit.limit("id").catch(() => undefined);

      const info = SCRIPTS.multiRegion.fixedWindow.limit;
      const enabled = keyLocking !== false;
      expect(calls[0]).toEqual({
        command: "evalsha",
        arg: enabled ? info.hash : info.hashWithoutKeyLocking!,
      });
      for (const call of calls.filter((c) => c.command === "eval")) {
        expect(call.arg.startsWith(KEY_LOCKING_SHEBANG)).toBe(enabled);
      }
    });
  }
});
