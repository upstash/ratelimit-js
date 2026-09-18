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
        hash: "8530c6ef7de4f949e5b0de313eb8f30281d75566"
      },
      getRemaining: {
        script: Single.fixedWindowRemainingTokensScript,
        hash: "823cb2a5a902d69681244f5e28e5ebb8f2a89edd"
      },
    },
    slidingWindow: {
      limit: {
        script: Single.slidingWindowLimitScript,
        hash: "04732625198ef4d52752a78e20f9becb4495e008"
      },
      getRemaining: {
        script: Single.slidingWindowRemainingTokensScript,
        hash: "7ca36169e0fc9caedd81b4eef8e99854c157f9b5"
      },
    },
    tokenBucket: {
      limit: {
        script: Single.tokenBucketLimitScript,
        hash: "d60be5bd3d83482ae229309f1f7425424f891204"
      },
      getRemaining: {
        script: Single.tokenBucketRemainingTokensScript,
        hash: "40daf4a441df736f5c99f8b77bbe176c909e5de4"
      },
    },
    cachedFixedWindow: {
      limit: {
        script: Single.cachedFixedWindowLimitScript,
        hash: "045da907b7638db8fc27e02025bbc40f1f73a433"
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
        hash: "13aaff753f591c26b1121a8b9104f899b0687c38"
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
