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
        hash: "b13943e359636db027ad280f1def143f02158c13"
      },
      getRemaining: {
        script: Single.fixedWindowRemainingTokensScript,
        hash: "8c4c341934502aee132643ffbe58ead3450e5208"
      },
    },
    slidingWindow: {
      limit: {
        script: Single.slidingWindowLimitScript,
        hash: "e1391e429b699c780eb0480350cd5b7280fd9213"
      },
      getRemaining: {
        script: Single.slidingWindowRemainingTokensScript,
        hash: "65a73ac5a05bf9712903bc304b77268980c1c417"
      },
    },
    tokenBucket: {
      limit: {
        script: Single.tokenBucketLimitScript,
        hash: "5bece90aeef8189a8cfd28995b479529e270b3c6"
      },
      getRemaining: {
        script: Single.tokenBucketRemainingTokensScript,
        hash: "a15be2bb1db2a15f7c82db06146f9d08983900d0"
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
        hash: "cb4fdc2575056df7c6d422764df0de3a08d6753b"
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