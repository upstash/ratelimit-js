import { createHash } from "node:crypto";
import { describe, expect, test } from "bun:test";
import { RESET_SCRIPT, SCRIPTS } from "./hash";

describe("should use correct hash for lua scripts", () => {
  const validateHash = (script: string, expectedHash: string) => {
    const hash = createHash("sha1").update(script).digest("hex")
    expect(hash).toBe(expectedHash)
  }

  const algorithms = [
    ...Object.entries(SCRIPTS.singleRegion), ...Object.entries(SCRIPTS.multiRegion)
  ]

  // for each algorithm (fixedWindow, slidingWindow etc)
  for (const [algorithm, scripts] of algorithms) {
    describe(`${algorithm}`, () => {
      // for each method (limit & getRemaining)
      for (const [method, scriptInfo] of Object.entries(scripts)) {
        test(method, () => {
          validateHash(scriptInfo.script, scriptInfo.hash)
        })
      }
    })
  }

  test("reset script", () => {
    validateHash(RESET_SCRIPT.script, RESET_SCRIPT.hash)
  })
})
