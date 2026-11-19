import { Redis } from "@upstash/redis";
import { describe, expect, test } from "bun:test";
import { RESET_SCRIPT, SCRIPTS } from "./hash";

describe("should use correct hash for lua scripts", () => {
  const redis = Redis.fromEnv();

  const validateHash = async (script: string, expectedHash: string) => {
    const hash = await redis.scriptLoad(script);
    expect(hash).toBe(expectedHash);
  };

  const algorithms = [
    ...Object.entries(SCRIPTS.singleRegion),
    ...Object.entries(SCRIPTS.multiRegion),
  ];

  // for each algorithm (fixedWindow, slidingWindow etc)
  for (const [algorithm, scripts] of algorithms) {
    describe(`${algorithm}`, () => {
      // for each method (limit & getRemaining)
      for (const [method, scriptInfo] of Object.entries(scripts)) {
        test(method, async () => {
          await validateHash(scriptInfo.script, scriptInfo.hash);
          if (scriptInfo.noKeyLockingScript && scriptInfo.noKeyLockingHash) {
            await validateHash(scriptInfo.noKeyLockingScript, scriptInfo.noKeyLockingHash);
          }
        });
      }
    });
  }

  test("reset script", async () => {
    await validateHash(RESET_SCRIPT.script, RESET_SCRIPT.hash);
    if (RESET_SCRIPT.noKeyLockingScript && RESET_SCRIPT.noKeyLockingHash) {
      await validateHash(RESET_SCRIPT.noKeyLockingScript, RESET_SCRIPT.noKeyLockingHash);
    }
  });
});
