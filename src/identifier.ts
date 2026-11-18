import { DYNAMIC_LIMIT_KEY_SUFFIX } from "./constants";
import { DenyListExtension, IpDenyListKey, IpDenyListStatusKey } from "./types";

const ANALYTICS_TABLE = "events";

/**
 * Keys the library keeps for itself, without the prefix
 */
const RESERVED_KEYS = new Set<string>([
  DYNAMIC_LIMIT_KEY_SUFFIX.slice(1),
  [DenyListExtension, "all"].join(":"),
  [DenyListExtension, IpDenyListKey].join(":"),
  IpDenyListStatusKey,
]);

const ANALYTICS_KEY = new RegExp(String.raw`^${ANALYTICS_TABLE}:\d+$`);

/**
 * Identifiers whose keys would include a key the library keeps for itself
 * when they are reset with a pattern
 */
const RESERVED_RESET_IDENTIFIERS = new Set<string>([
  DYNAMIC_LIMIT_KEY_SUFFIX.split(":")[1],
  DenyListExtension,
  ANALYTICS_TABLE,
]);

const reserved = (identifier: string) =>
  new Error(`"${identifier}" is reserved and can't be used as an identifier`);

/**
 * For algorithms which store an identifier under a single key with no
 * suffix. Throws if that key is one the library keeps for itself.
 */
export const assertKeyIsFree = (prefix: string, key: string): void => {
  const start = `${prefix}:`;
  const identifier = key.startsWith(start) ? key.slice(start.length) : key;
  if (RESERVED_KEYS.has(identifier) || ANALYTICS_KEY.test(identifier)) {
    throw reserved(identifier);
  }
};

/**
 * Resetting an identifier scans for the keys which start with it. Throws if
 * that scan would include a key the library keeps for itself.
 */
export const assertResetIsFree = (identifier: string): void => {
  const value = String(identifier);
  if (RESERVED_RESET_IDENTIFIERS.has(value)) {
    throw reserved(value);
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
