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
        hash: "b9a1f390f466f1706d7edcb5ae444a3931ea182f"
      },
      getRemaining: {
        script: Single.slidingWindowRemainingTokensScript,
        hash: "65a73ac5a05bf9712903bc304b77268980c1c417"
      },
    },
    tokenBucket: {
      limit: {
        script: Single.tokenBucketLimitScript,
        hash: "d1f857ebbdaeca90ccd2cd4eada61d7c8e5db1ca"
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
        hash: "4bec2a53f5bc651ad05a99b6cbc1a0c54f391d21"
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
