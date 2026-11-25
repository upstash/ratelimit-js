import * as Single from "./single"
import * as Multi from "./multi"
import { resetScript } from "./reset"

export type ScriptInfo = {
  /**
   * Name of the script, sent to Upstash Redis as part of the `script_name`
   * flag (see `buildScript` in src/hash.ts).
   */
  name: string,
  /**
   * The lua script without any shebang line.
   */
  script: string,
  /**
   * Whether the script can run with the `allow-key-locking` flag. Only scripts
   * which touch nothing but the keys passed in KEYS can.
   */
  keyLocking: boolean,
}

type Algorithm = {
  limit: ScriptInfo,
  getRemaining: ScriptInfo,
}

type AlgorithmKind =
  | "fixedWindow"
  | "slidingWindow"
  | "tokenBucket"
  | "cachedFixedWindow"

const lockingScript = (name: string, script: string): ScriptInfo => ({
  name,
  script,
  keyLocking: true,
})

export const SCRIPTS: {
  singleRegion: Record<AlgorithmKind, Algorithm>,
  multiRegion: Record<Exclude<AlgorithmKind, "tokenBucket" | "cachedFixedWindow">, Algorithm>,
} = {
  singleRegion: {
    fixedWindow: {
      limit: lockingScript("fixed_window_limit", Single.fixedWindowLimitScript),
      getRemaining: lockingScript("fixed_window_get_remaining", Single.fixedWindowRemainingTokensScript),
    },
    slidingWindow: {
      limit: lockingScript("sliding_window_limit", Single.slidingWindowLimitScript),
      getRemaining: lockingScript("sliding_window_get_remaining", Single.slidingWindowRemainingTokensScript),
    },
    tokenBucket: {
      limit: lockingScript("token_bucket_limit", Single.tokenBucketLimitScript),
      getRemaining: lockingScript("token_bucket_get_remaining", Single.tokenBucketRemainingTokensScript),
    },
    cachedFixedWindow: {
      limit: lockingScript("cached_fixed_window_limit", Single.cachedFixedWindowLimitScript),
      getRemaining: lockingScript("cached_fixed_window_get_remaining", Single.cachedFixedWindowRemainingTokenScript),
    }
  },
  multiRegion: {
    fixedWindow: {
      limit: lockingScript("multi_fixed_window_limit", Multi.fixedWindowLimitScript),
      getRemaining: lockingScript("multi_fixed_window_get_remaining", Multi.fixedWindowRemainingTokensScript),
    },
    slidingWindow: {
      limit: lockingScript("multi_sliding_window_limit", Multi.slidingWindowLimitScript),
      getRemaining: lockingScript("multi_sliding_window_get_remaining", Multi.slidingWindowRemainingTokensScript),
    },
  }
}

/** COMMON */
export const RESET_SCRIPT: ScriptInfo = {
  name: "reset",
  script: resetScript,
  // scans keys by pattern, so it can't declare its keys up front
  keyLocking: false,
}
