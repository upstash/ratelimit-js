import { createHash } from "node:crypto";
import { describe, expect, test } from "bun:test";
import { SCRIPTS } from "./hash";

/**
 * Script hashes are hand-maintained. Whenever a Lua script changes, its
 * sha1 in `hash.ts` must be updated too, otherwise `safeEval` falls back to
 * `EVAL` on every call. This test needs no database and catches a stale hash
 * before it reaches a live run.
 */
describe("lua script hashes", () => {
  for (const [region, algorithms] of Object.entries(SCRIPTS)) {
    for (const [algorithm, kinds] of Object.entries(algorithms)) {
      for (const [kind, { script, hash }] of Object.entries(kinds)) {
        test(`${region}.${algorithm}.${kind} hash matches script`, () => {
          const actual = createHash("sha1").update(script).digest("hex");
          expect(actual).toBe(hash);
        });
      }
    }
  }
});
