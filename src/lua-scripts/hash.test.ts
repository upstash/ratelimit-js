import { Redis } from "@upstash/redis";
import { describe, expect, test } from "bun:test";
import { buildScript } from "../hash";
import { RESET_SCRIPT, SCRIPTS } from "./hash";

describe("hardcoded hashes match the ones in Upstash Redis", () => {
  const redis = Redis.fromEnv();

  const scripts = [
    ...Object.entries(SCRIPTS.singleRegion),
    ...Object.entries(SCRIPTS.multiRegion),
  ].flatMap(([algorithm, methods]) =>
    Object.entries(methods).map(([method, info]) => [`${algorithm}.${method}`, info] as const),
  );

  for (const [name, info] of [...scripts, ["reset", RESET_SCRIPT] as const]) {
    test(name, async () => {
      expect(await redis.scriptLoad(buildScript(info, true))).toBe(info.hash);
    });
  }
});
