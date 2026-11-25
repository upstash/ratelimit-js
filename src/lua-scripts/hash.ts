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
   * sha1 of the script with the Upstash flags, `buildScript(info, true)`.
   * Used to run the script with EVALSHA.
   */
  hash: string,
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
        hash: "effda0a41abc913ef786d05b1bd2520e7e7b30a7",
        keyLocking: true,
      },
      getRemaining: {
        name: "fixed_window_get_remaining",
        script: Single.fixedWindowRemainingTokensScript,
        hash: "70f302ced71ea4a0ba4b97de6f748287ef3c7ed8",
        keyLocking: true,
      },
    },
    slidingWindow: {
      limit: {
        name: "sliding_window_limit",
        script: Single.slidingWindowLimitScript,
        hash: "b364864456340eb535dc0f16cef89b2badd08984",
        keyLocking: true,
      },
      getRemaining: {
        name: "sliding_window_get_remaining",
        script: Single.slidingWindowRemainingTokensScript,
        hash: "06150b67e4c9fbe34cdf6c3515054a229b01f1d9",
        keyLocking: true,
      },
    },
    tokenBucket: {
      limit: {
        name: "token_bucket_limit",
        script: Single.tokenBucketLimitScript,
        hash: "7a30587c0fa7f20c295a2883f07ac460cbd2e1b4",
        keyLocking: true,
      },
      getRemaining: {
        name: "token_bucket_get_remaining",
        script: Single.tokenBucketRemainingTokensScript,
        hash: "4f990ab2b18877d7b8930df27afe466ca062687f",
        keyLocking: true,
      },
    },
    cachedFixedWindow: {
      limit: {
        name: "cached_fixed_window_limit",
        script: Single.cachedFixedWindowLimitScript,
        hash: "1cedb66a100a062661faf6137b57cbc5bf19dd22",
        keyLocking: true,
      },
      getRemaining: {
        name: "cached_fixed_window_get_remaining",
        script: Single.cachedFixedWindowRemainingTokenScript,
        hash: "8737e4f2cb40a28d6af5ccccef39e98e2126bf70",
        keyLocking: true,
      },
    }
  },
  multiRegion: {
    fixedWindow: {
      limit: {
        name: "multi_fixed_window_limit",
        script: Multi.fixedWindowLimitScript,
        hash: "672957e9bac471e7b241fddd497e69ffaa2edfba",
        keyLocking: true,
      },
      getRemaining: {
        name: "multi_fixed_window_get_remaining",
        script: Multi.fixedWindowRemainingTokensScript,
        hash: "7483925053daea90ed7a79fc205db25797ead908",
        keyLocking: true,
      },
    },
    slidingWindow: {
      limit: {
        name: "multi_sliding_window_limit",
        script: Multi.slidingWindowLimitScript,
        hash: "e3cfd0baa7f5e2d4dfe8ca99823e59a8c8cb96bd",
        keyLocking: true,
      },
      getRemaining: {
        name: "multi_sliding_window_get_remaining",
        script: Multi.slidingWindowRemainingTokensScript,
        hash: "aeb291b226581b63f125a020921fe1fd17073f63",
        keyLocking: true,
      },
    },
  }
}

/** COMMON */
export const RESET_SCRIPT: ScriptInfo = {
  name: "reset",
  script: resetScript,
  hash: "ba263d57e212322c09575b8e14273aa92328240a",
  // scans keys by pattern, so it can't declare its keys up front
  keyLocking: false,
}
