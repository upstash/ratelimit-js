import * as Single from "./single";
import * as Multi from "./multi";
import { resetScript } from "./reset";

export const stripKeyLocking = (script: string): string => {
  return script.replace(/^#!lua flags=allow-key-locking\n/, "\n");
};

export type ScriptInfo = {
  script: string;
  hash: string;
  noKeyLockingScript?: string;
  noKeyLockingHash?: string;
};

type Algorithm = {
  limit: ScriptInfo;
  getRemaining: ScriptInfo;
};

type AlgorithmKind = "fixedWindow" | "slidingWindow" | "tokenBucket" | "cachedFixedWindow";

export const SCRIPTS: {
  singleRegion: Record<AlgorithmKind, Algorithm>;
  multiRegion: Record<Exclude<AlgorithmKind, "tokenBucket" | "cachedFixedWindow">, Algorithm>;
} = {
  singleRegion: {
    fixedWindow: {
      limit: {
        script: Single.fixedWindowLimitScript,
        hash: "b2efc02798c8e9b471a10f9b1d5745db89923ff3",
        noKeyLockingScript: stripKeyLocking(Single.fixedWindowLimitScript),
        noKeyLockingHash: "e621cfa1bf79816e236755bae11062fc8a0913c2",
      },
      getRemaining: {
        script: Single.fixedWindowRemainingTokensScript,
        hash: "823cb2a5a902d69681244f5e28e5ebb8f2a89edd",
        noKeyLockingScript: stripKeyLocking(Single.fixedWindowRemainingTokensScript),
        noKeyLockingHash: "d8916faf3559355c7a018fe086f75919918a8b2f",
      },
    },
    slidingWindow: {
      limit: {
        script: Single.slidingWindowLimitScript,
        hash: "74740bb3d7792848093cdef586b6b6037c455fd6",
        noKeyLockingScript: stripKeyLocking(Single.slidingWindowLimitScript),
        noKeyLockingHash: "d457e1a9a5d603d8375542e7cdc0ba52fcaf983a",
      },
      getRemaining: {
        script: Single.slidingWindowRemainingTokensScript,
        hash: "7ca36169e0fc9caedd81b4eef8e99854c157f9b5",
        noKeyLockingScript: stripKeyLocking(Single.slidingWindowRemainingTokensScript),
        noKeyLockingHash: "3d93306614327fa6ffcdaacac7c952011217faa0",
      },
    },
    tokenBucket: {
      limit: {
        script: Single.tokenBucketLimitScript,
        hash: "d60be5bd3d83482ae229309f1f7425424f891204",
        noKeyLockingScript: stripKeyLocking(Single.tokenBucketLimitScript),
        noKeyLockingHash: "825d0e3b8bccc1f844b47ea80f50955d6e39a77a",
      },
      getRemaining: {
        script: Single.tokenBucketRemainingTokensScript,
        hash: "40daf4a441df736f5c99f8b77bbe176c909e5de4",
        noKeyLockingScript: stripKeyLocking(Single.tokenBucketRemainingTokensScript),
        noKeyLockingHash: "fe4d4719867fce5a3133a00520cb08e88c732715",
      },
    },
    cachedFixedWindow: {
      limit: {
        script: Single.cachedFixedWindowLimitScript,
        hash: "1861a700bafe96c833a483af6b1c28a8897cfdb0",
        noKeyLockingScript: stripKeyLocking(Single.cachedFixedWindowLimitScript),
        noKeyLockingHash: "c26b12703dd137939b9a69a3a9b18e906a2d940f",
      },
      getRemaining: {
        script: Single.cachedFixedWindowRemainingTokenScript,
        hash: "eb82f0e853d2fc9a236fa9bfbe704fda6ac2fc36",
        noKeyLockingScript: stripKeyLocking(Single.cachedFixedWindowRemainingTokenScript),
        noKeyLockingHash: "8e8f222ccae68b595ee6e3f3bf2199629a62b91a",
      },
    },
  },
  multiRegion: {
    fixedWindow: {
      limit: {
        script: Multi.fixedWindowLimitScript,
        hash: "e04b753a75909b7f99aae4c04cf8869a8de02a9e",
        noKeyLockingScript: stripKeyLocking(Multi.fixedWindowLimitScript),
        noKeyLockingHash: "a8c14f3835aa87bd70e5e2116081b81664abcf5c",
      },
      getRemaining: {
        script: Multi.fixedWindowRemainingTokensScript,
        hash: "e066c8ce3eaca142b0894ad1541e0a58c9924819",
        noKeyLockingScript: stripKeyLocking(Multi.fixedWindowRemainingTokensScript),
        noKeyLockingHash: "8ab8322d0ed5fe5ac8eb08f0c2e4557f1b4816fd",
      },
    },
    slidingWindow: {
      limit: {
        script: Multi.slidingWindowLimitScript,
        hash: "aeb4d8f381e8dafc8e69041baae1324d254ded44",
        noKeyLockingScript: stripKeyLocking(Multi.slidingWindowLimitScript),
        noKeyLockingHash: "1e7ca8dcd2d600a6d0124a67a57ea225ed62921b",
      },
      getRemaining: {
        script: Multi.slidingWindowRemainingTokensScript,
        hash: "87828c1088f6a8d1f512a434ea330189982a1c0a",
        noKeyLockingScript: stripKeyLocking(Multi.slidingWindowRemainingTokensScript),
        noKeyLockingHash: "558c9306b7ec54abb50747fe0b17e5d44bd24868",
      },
    },
  },
};

/** COMMON */
export const RESET_SCRIPT: ScriptInfo = {
  script: resetScript,
  hash: "54bd274ddc59fb3be0f42deee2f64322a10e2b50",
  noKeyLockingScript: resetScript,
  noKeyLockingHash: "54bd274ddc59fb3be0f42deee2f64322a10e2b50",
};
