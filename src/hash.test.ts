import { Redis } from "@upstash/redis";
import { describe, test } from "bun:test";
import { safeEval } from "./hash";
import { SCRIPTS } from "./lua-scripts/hash";
import { DEFAULT_PREFIX } from "./constants";

const redis = Redis.fromEnv();

describe("should set hash correctly", () => {
  test("should set hash in new db correctly", async () => {
    await redis.scriptFlush()

    // sleep for two secs
    await new Promise(r => setTimeout(r, 2000));

    await safeEval(
      {
        redis,
        prefix: DEFAULT_PREFIX
      },
      SCRIPTS.singleRegion.fixedWindow.limit,
      ["id", ""],
      [10, 10, 1]
    )
  })
})