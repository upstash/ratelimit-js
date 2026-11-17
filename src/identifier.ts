import { DYNAMIC_LIMIT_KEY_SUFFIX } from "./constants";
import { DenyListExtension, IpDenyListKey, IpDenyListStatusKey } from "./types";

const ANALYTICS_TABLE = "events";

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
 * Identifiers whose keys would include a key the library keeps for itself
 * when they are reset
 */
const RESERVED_RESET_IDENTIFIERS = new Set<string>([
  DYNAMIC_LIMIT_KEY_SUFFIX.split(":")[1],
  DenyListExtension,
  ANALYTICS_TABLE,
]);

const ANALYTICS_KEY = new RegExp(String.raw`^${ANALYTICS_TABLE}:\d+$`);

export const assertIdentifier = (identifier: string, reset = false): void => {
  const value = String(identifier);
  if (
    RESERVED_IDENTIFIERS.has(value) ||
    ANALYTICS_KEY.test(value) ||
    (reset && RESERVED_RESET_IDENTIFIERS.has(value))
  ) {
    throw new Error(`"${value}" is reserved and can't be used as an identifier`);
  }
};

/**
 * Escapes the characters which have a special meaning in a key pattern, so
 * that the value only matches itself. A backslash is written as a character
 * class, so that it can't combine with the character after it.
 */
export const escapePattern = (value: string): string =>
  value.replaceAll(/[*?[\\\]]/g, (character) =>
    character === "\\" ? String.raw`[\\]` : `\\${character}`
  );
