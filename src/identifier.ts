import { DYNAMIC_LIMIT_KEY_SUFFIX } from "./constants";
import { DenyListExtension, IpDenyListKey, IpDenyListStatusKey } from "./types";

/**
 * Identifiers which would resolve to a key the library keeps for itself
 */
const RESERVED_IDENTIFIERS = new Set<string>([
  DYNAMIC_LIMIT_KEY_SUFFIX.slice(1),
  [DenyListExtension, "all"].join(":"),
  [DenyListExtension, IpDenyListKey].join(":"),
  IpDenyListStatusKey,
]);

/**
 * Keys of the analytics buckets
 */
const ANALYTICS_KEY = /^events:\d+$/;

export const assertIdentifier = (identifier: string): void => {
  const value = String(identifier);
  if (RESERVED_IDENTIFIERS.has(value) || ANALYTICS_KEY.test(value)) {
    throw new Error(`"${value}" is reserved and can't be used as an identifier`);
  }
};
