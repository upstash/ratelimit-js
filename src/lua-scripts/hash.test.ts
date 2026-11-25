import { Redis } from "@upstash/redis";
import { describe, expect, test } from "bun:test";
import { buildScript, scriptHash } from "../hash";
import { RESET_SCRIPT, SCRIPTS } from "./hash";

describe("hashes computed in the sdk match the ones in Upstash Redis", () => {
  const redis = Redis.fromEnv();

  const scripts = [
    ...Object.entries(SCRIPTS.singleRegion),
    ...Object.entries(SCRIPTS.multiRegion),
  ].flatMap(([algorithm, methods]) =>
    Object.entries(methods).map(([method, info]) => [`${algorithm}.${method}`, info] as const),
  );

  for (const [name, info] of [...scripts, ["reset", RESET_SCRIPT] as const]) {
    for (const withFlags of [true, false]) {
      test(`${name} ${withFlags ? "with" : "without"} flags`, async () => {
        const script = buildScript(info, withFlags);
        expect(await redis.scriptLoad(script)).toBe((await scriptHash(script))!);
      });
    }
  }
});
