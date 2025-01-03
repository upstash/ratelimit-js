import { afterAll, beforeAll, describe, test } from "bun:test";
import { createClient } from "redis";
import { safeEval } from "./hash";
import { SCRIPTS } from "./lua-scripts/hash";

const redis = createClient({
  url: process.env.REDIS_URL ?? "redis://localhost:6379",
});

describe("should set hash correctly", () => {
  beforeAll(async () => {
    await redis.connect();
  });

  afterAll(async () => {
    await redis.quit();
  });

  test("should set hash in new db correctly", async () => {
    await redis.scriptFlush();

    // sleep for two secs
    await new Promise((r) => setTimeout(r, 2000));

    await safeEval(
      {
        redis,
      },
      SCRIPTS.singleRegion.fixedWindow.limit,
      ["id"],
      [10, 1]
    );
  });
});
