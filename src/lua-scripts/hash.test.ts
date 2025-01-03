import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createClient } from "redis";
import { RESET_SCRIPT, SCRIPTS } from "./hash";

const redis = createClient({
  url: process.env.REDIS_URL ?? "redis://localhost:6379",
});

describe("should use correct hash for lua scripts", () => {
  beforeAll(async () => {
    await redis.connect();
  });

  afterAll(async () => {
    await redis.quit();
  });

  const validateHash = async (script: string, expectedHash: string) => {
    const hash = await redis.scriptLoad(script);
    expect(hash).toBe(expectedHash);
  };

  const algorithms = [...Object.entries(SCRIPTS.singleRegion)];

  // for each algorithm (fixedWindow, slidingWindow etc)
  for (const [algorithm, scripts] of algorithms) {
    describe(`${algorithm}`, () => {
      // for each method (limit & getRemaining)
      for (const [method, scriptInfo] of Object.entries(scripts)) {
        test(method, async () => {
          await validateHash(scriptInfo.script, scriptInfo.hash);
        });
      }
    });
  }

  test("reset script", async () => {
    await validateHash(RESET_SCRIPT.script, RESET_SCRIPT.hash);
  });
});
