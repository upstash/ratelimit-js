import { resetScript } from "./reset";
import * as Single from "./single";

export type ScriptInfo = {
  script: string;
  hash: string;
};

type Algorithm = {
  limit: ScriptInfo;
  getRemaining: ScriptInfo;
};

type AlgorithmKind =
  | "fixedWindow"
  | "slidingWindow"
  | "tokenBucket"
  | "cachedFixedWindow";

export const SCRIPTS: {
  singleRegion: Record<AlgorithmKind, Algorithm>;
} = {
  singleRegion: {
    fixedWindow: {
      limit: {
        script: Single.fixedWindowLimitScript,
        hash: "b13943e359636db027ad280f1def143f02158c13",
      },
      getRemaining: {
        script: Single.fixedWindowRemainingTokensScript,
        hash: "8c4c341934502aee132643ffbe58ead3450e5208",
      },
    },
    slidingWindow: {
      limit: {
        script: Single.slidingWindowLimitScript,
        hash: "e1391e429b699c780eb0480350cd5b7280fd9213",
      },
      getRemaining: {
        script: Single.slidingWindowRemainingTokensScript,
        hash: "65a73ac5a05bf9712903bc304b77268980c1c417",
      },
    },
    tokenBucket: {
      limit: {
        script: Single.tokenBucketLimitScript,
        hash: "5bece90aeef8189a8cfd28995b479529e270b3c6",
      },
      getRemaining: {
        script: Single.tokenBucketRemainingTokensScript,
        hash: "a15be2bb1db2a15f7c82db06146f9d08983900d0",
      },
    },
    cachedFixedWindow: {
      limit: {
        script: Single.cachedFixedWindowLimitScript,
        hash: "c26b12703dd137939b9a69a3a9b18e906a2d940f",
      },
      getRemaining: {
        script: Single.cachedFixedWindowRemainingTokenScript,
        hash: "8e8f222ccae68b595ee6e3f3bf2199629a62b91a",
      },
    },
  },
};

/** COMMON */
export const RESET_SCRIPT: ScriptInfo = {
  script: resetScript,
  hash: "54bd274ddc59fb3be0f42deee2f64322a10e2b50",
};
