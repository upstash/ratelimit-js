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
        hash: "4ef8749b9e927b157546ebad13061fa86b9ffc2e"
      },
      getRemaining: {
        script: Single.fixedWindowRemainingTokensScript,
        hash: "e62252cb05b4676b27a5d396da02f0ca0d375d88"
      },
    },
    slidingWindow: {
      limit: {
        script: Single.slidingWindowLimitScript,
        hash: "5cd9665be7533e4dfabb3581021737fc69b41ae8"
      },
      getRemaining: {
        script: Single.slidingWindowRemainingTokensScript,
        hash: "1bdbbdb2082bb557084518c64486d7d5a29d1bfe"
      },
    },
    tokenBucket: {
      limit: {
        script: Single.tokenBucketLimitScript,
        hash: "8f7286b9b0f65d631f760ba615f7b3c598a569a3"
      },
      getRemaining: {
        script: Single.tokenBucketRemainingTokensScript,
        hash: "08d3b3381c507b6f7bfec1bbfa0a6053434b16bd"
      },
    },
    cachedFixedWindow: {
      limit: {
        script: Single.cachedFixedWindowLimitScript,
        hash: "1861a700bafe96c833a483af6b1c28a8897cfdb0"
      },
      getRemaining: {
        script: Single.cachedFixedWindowRemainingTokenScript,
        hash: "eb82f0e853d2fc9a236fa9bfbe704fda6ac2fc36"
      },
    }
  },
  multiRegion: {
    fixedWindow: {
      limit: {
        script: Multi.fixedWindowLimitScript,
        hash: "e04b753a75909b7f99aae4c04cf8869a8de02a9e"
      },
      getRemaining: {
        script: Multi.fixedWindowRemainingTokensScript,
        hash: "e066c8ce3eaca142b0894ad1541e0a58c9924819"
      },
    },
    slidingWindow: {
      limit: {
        script: Multi.slidingWindowLimitScript,
        hash: "aeb4d8f381e8dafc8e69041baae1324d254ded44"
      },
      getRemaining: {
        script: Multi.slidingWindowRemainingTokensScript,
        hash: "87828c1088f6a8d1f512a434ea330189982a1c0a"
      },
    },
  }
}

/** COMMON */
export const RESET_SCRIPT: ScriptInfo = {
  script: resetScript,
  hash: "54bd274ddc59fb3be0f42deee2f64322a10e2b50"
}
