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

export const SCRIPTS: {
  singleRegion: Record<AlgorithmKind, Algorithm>,
  multiRegion: Record<Exclude<AlgorithmKind, "tokenBucket" | "cachedFixedWindow">, Algorithm>,
} = {
  singleRegion: {
    fixedWindow: {
      limit: {
        name: "fixed_window_limit",
        script: Single.fixedWindowLimitScript,
        keyLocking: true,
      },
      getRemaining: {
        name: "fixed_window_get_remaining",
        script: Single.fixedWindowRemainingTokensScript,
        keyLocking: true,
      },
    },
    slidingWindow: {
      limit: {
        name: "sliding_window_limit",
        script: Single.slidingWindowLimitScript,
        keyLocking: true,
      },
      getRemaining: {
        name: "sliding_window_get_remaining",
        script: Single.slidingWindowRemainingTokensScript,
        keyLocking: true,
      },
    },
    tokenBucket: {
      limit: {
        name: "token_bucket_limit",
        script: Single.tokenBucketLimitScript,
        keyLocking: true,
      },
      getRemaining: {
        name: "token_bucket_get_remaining",
        script: Single.tokenBucketRemainingTokensScript,
        keyLocking: true,
      },
    },
    cachedFixedWindow: {
      limit: {
        name: "cached_fixed_window_limit",
        script: Single.cachedFixedWindowLimitScript,
        keyLocking: true,
      },
      getRemaining: {
        name: "cached_fixed_window_get_remaining",
        script: Single.cachedFixedWindowRemainingTokenScript,
        keyLocking: true,
      },
    }
  },
  multiRegion: {
    fixedWindow: {
      limit: {
        name: "multi_fixed_window_limit",
        script: Multi.fixedWindowLimitScript,
        keyLocking: true,
      },
      getRemaining: {
        name: "multi_fixed_window_get_remaining",
        script: Multi.fixedWindowRemainingTokensScript,
        keyLocking: true,
      },
    },
    slidingWindow: {
      limit: {
        name: "multi_sliding_window_limit",
        script: Multi.slidingWindowLimitScript,
        keyLocking: true,
      },
      getRemaining: {
        name: "multi_sliding_window_get_remaining",
        script: Multi.slidingWindowRemainingTokensScript,
        keyLocking: true,
      },
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
