import * as Single from "./single"
import * as Multi from "./multi"
import { resetScript } from "./reset"

export type ScriptInfo = {
  script: string,
  hash: string
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
        script: Single.fixedWindowLimitScript,
        hash: "472e55443b62f60d0991028456c57815a387066d"
      },
      getRemaining: {
        script: Single.fixedWindowRemainingTokensScript,
        hash: "40515c9dd0a08f8584f5f9b593935f6a87c1c1c3"
      },
    },
    slidingWindow: {
      limit: {
        script: Single.slidingWindowLimitScript,
        hash: "977fb636fb5ceb7e98a96d1b3a1272ba018efdae"
      },
      getRemaining: {
        script: Single.slidingWindowRemainingTokensScript,
        hash: "ee3a3265fad822f83acad23f8a1e2f5c0b156b03"
      },
    },
    tokenBucket: {
      limit: {
        script: Single.tokenBucketLimitScript,
        hash: "b35c5bc0b7fdae7dd0573d4529911cabaf9d1d89"
      },
      getRemaining: {
        script: Single.tokenBucketRemainingTokensScript,
        hash: "deb03663e8af5a968deee895dd081be553d2611b"
      },
    },
    cachedFixedWindow: {
      limit: {
        script: Single.cachedFixedWindowLimitScript,
        hash: "c26b12703dd137939b9a69a3a9b18e906a2d940f"
      },
      getRemaining: {
        script: Single.cachedFixedWindowRemainingTokenScript,
        hash: "8e8f222ccae68b595ee6e3f3bf2199629a62b91a"
      },
    }
  },
  multiRegion: {
    fixedWindow: {
      limit: {
        script: Multi.fixedWindowLimitScript,
        hash: "a8c14f3835aa87bd70e5e2116081b81664abcf5c"
      },
      getRemaining: {
        script: Multi.fixedWindowRemainingTokensScript,
        hash: "8ab8322d0ed5fe5ac8eb08f0c2e4557f1b4816fd"
      },
    },
    slidingWindow: {
      limit: {
        script: Multi.slidingWindowLimitScript,
        hash: "1e7ca8dcd2d600a6d0124a67a57ea225ed62921b"
      },
      getRemaining: {
        script: Multi.slidingWindowRemainingTokensScript,
        hash: "558c9306b7ec54abb50747fe0b17e5d44bd24868"
      },
    },
  }
}

/** COMMON */
export const RESET_SCRIPT: ScriptInfo = {
  script: resetScript,
  hash: "54bd274ddc59fb3be0f42deee2f64322a10e2b50"
}
