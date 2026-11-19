import * as Single from "./single"
import * as Multi from "./multi"
import { resetScript } from "./reset"

export const KEY_LOCKING_SHEBANG = "#!lua flags=allow-key-locking\n";

export type ScriptInfo = {
  script: string,
  hash: string,
  /**
   * Hash of the script with the key locking shebang removed.
   * Only set for scripts which start with KEY_LOCKING_SHEBANG.
   */
  hashWithoutKeyLocking?: string
}

/**
 * Returns the script without the `allow-key-locking` shebang, for Redis servers
 * which don't support it (self-hosted Redis, SRH etc).
 */
export const withoutKeyLocking = (info: ScriptInfo): ScriptInfo => {
  if (!info.hashWithoutKeyLocking || !info.script.startsWith(KEY_LOCKING_SHEBANG)) {
    return info;
  }
  return {
    script: info.script.slice(KEY_LOCKING_SHEBANG.length),
    hash: info.hashWithoutKeyLocking,
  };
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
        hash: "b2efc02798c8e9b471a10f9b1d5745db89923ff3",
        hashWithoutKeyLocking: "649206bd18ab739a3bbe805459c7605343351cf9"
      },
      getRemaining: {
        script: Single.fixedWindowRemainingTokensScript,
        hash: "823cb2a5a902d69681244f5e28e5ebb8f2a89edd",
        hashWithoutKeyLocking: "92c3f5bc991eab9794c933f95682494ded579edf"
      },
    },
    slidingWindow: {
      limit: {
        script: Single.slidingWindowLimitScript,
        hash: "74740bb3d7792848093cdef586b6b6037c455fd6",
        hashWithoutKeyLocking: "433177fc5bbe571478bf6dff0c2bdc6e3d0a69be"
      },
      getRemaining: {
        script: Single.slidingWindowRemainingTokensScript,
        hash: "7ca36169e0fc9caedd81b4eef8e99854c157f9b5",
        hashWithoutKeyLocking: "209adfca45d535f9fb918f647c11237a97300b8e"
      },
    },
    tokenBucket: {
      limit: {
        script: Single.tokenBucketLimitScript,
        hash: "d60be5bd3d83482ae229309f1f7425424f891204",
        hashWithoutKeyLocking: "35508b8f4c201c56dfd63e52012b34f1a76a8a7a"
      },
      getRemaining: {
        script: Single.tokenBucketRemainingTokensScript,
        hash: "40daf4a441df736f5c99f8b77bbe176c909e5de4",
        hashWithoutKeyLocking: "178927d1e18723fecf8c9252a9f62dd59bdbbe5c"
      },
    },
    cachedFixedWindow: {
      limit: {
        script: Single.cachedFixedWindowLimitScript,
        hash: "1861a700bafe96c833a483af6b1c28a8897cfdb0",
        hashWithoutKeyLocking: "aa81929b352a5e00708440e0f939d67a43a9233c"
      },
      getRemaining: {
        script: Single.cachedFixedWindowRemainingTokenScript,
        hash: "eb82f0e853d2fc9a236fa9bfbe704fda6ac2fc36",
        hashWithoutKeyLocking: "4eddfb45c01317b720e7585ccb6d8c596200911f"
      },
    }
  },
  multiRegion: {
    fixedWindow: {
      limit: {
        script: Multi.fixedWindowLimitScript,
        hash: "e04b753a75909b7f99aae4c04cf8869a8de02a9e",
        hashWithoutKeyLocking: "dd617b8e36ef0d025dbfd3b00702a9c3d24bd5f2"
      },
      getRemaining: {
        script: Multi.fixedWindowRemainingTokensScript,
        hash: "e066c8ce3eaca142b0894ad1541e0a58c9924819",
        hashWithoutKeyLocking: "b380c9ccb0644f2c1cd2c3498097fc212c8992e0"
      },
    },
    slidingWindow: {
      limit: {
        script: Multi.slidingWindowLimitScript,
        hash: "aeb4d8f381e8dafc8e69041baae1324d254ded44",
        hashWithoutKeyLocking: "952d20e72efeb420160e17df716b59ffd2256a11"
      },
      getRemaining: {
        script: Multi.slidingWindowRemainingTokensScript,
        hash: "87828c1088f6a8d1f512a434ea330189982a1c0a",
        hashWithoutKeyLocking: "b448b907e75790a1735a220b54dc7c8bb2135cd1"
      },
    },
  }
}

/** COMMON */
export const RESET_SCRIPT: ScriptInfo = {
  script: resetScript,
  hash: "54bd274ddc59fb3be0f42deee2f64322a10e2b50"
}
