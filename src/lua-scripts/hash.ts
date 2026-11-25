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
        hash: "0d8f89cff289d3cca05493b1fc45a8f132bf023a",
        keyLocking: true,
      },
      getRemaining: {
        name: "fixed_window_get_remaining",
        script: Single.fixedWindowRemainingTokensScript,
        hash: "50bd9577291f1c2b406834437c99aef5723218fa",
        keyLocking: true,
      },
    },
    slidingWindow: {
      limit: {
        name: "sliding_window_limit",
        script: Single.slidingWindowLimitScript,
        hash: "4db5d253d3de4901a12d9a251bb2092fc52176a0",
        keyLocking: true,
      },
      getRemaining: {
        name: "sliding_window_get_remaining",
        script: Single.slidingWindowRemainingTokensScript,
        hash: "8fa584c1d9b5a7b6011c3a2d0f2cbaa4ca690d2b",
        keyLocking: true,
      },
    },
    tokenBucket: {
      limit: {
        name: "token_bucket_limit",
        script: Single.tokenBucketLimitScript,
        hash: "a554b17039f433ebededaab6ee5d3f6643b35ae1",
        keyLocking: true,
      },
      getRemaining: {
        name: "token_bucket_get_remaining",
        script: Single.tokenBucketRemainingTokensScript,
        hash: "5ac480712398d0ffa9cfbef7893db048af9a9088",
        keyLocking: true,
      },
    },
    cachedFixedWindow: {
      limit: {
        name: "cached_fixed_window_limit",
        script: Single.cachedFixedWindowLimitScript,
        hash: "3b9bb509fad57a80c263089d3da47c13041ba6a1",
        keyLocking: true,
      },
      getRemaining: {
        name: "cached_fixed_window_get_remaining",
        script: Single.cachedFixedWindowRemainingTokenScript,
        hash: "811f50ee5eaa5a1a8e46dd0d2e8178ad5612d846",
        keyLocking: true,
      },
    }
  },
  multiRegion: {
    fixedWindow: {
      limit: {
        name: "multi_fixed_window_limit",
        script: Multi.fixedWindowLimitScript,
        hash: "2047a806b79a0770de8c21c12e6925b617128dad",
        keyLocking: true,
      },
      getRemaining: {
        name: "multi_fixed_window_get_remaining",
        script: Multi.fixedWindowRemainingTokensScript,
        hash: "79626b025dfb424bca6ec40316a5efe6609aeb1b",
        keyLocking: true,
      },
    },
    slidingWindow: {
      limit: {
        name: "multi_sliding_window_limit",
        script: Multi.slidingWindowLimitScript,
        hash: "35bb924a560177c36eb8203b76242841dbdee620",
        keyLocking: true,
      },
      getRemaining: {
        name: "multi_sliding_window_get_remaining",
        script: Multi.slidingWindowRemainingTokensScript,
        hash: "0ceb6b69aca95f41b3b30a5508b0d11d8aa2746b",
        keyLocking: true,
      },
    },
  }
}

/** COMMON */
export const RESET_SCRIPT: ScriptInfo = {
  name: "reset",
  script: resetScript,
  hash: "73a3da2fbac6fb87c922735b0b239a63401ec4b9",
  // scans keys by pattern, so it can't declare its keys up front
  keyLocking: false,
}
