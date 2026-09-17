/**
 * Constants used throughout the ratelimit library
 */

/**
 * Suffix for the global dynamic limit key in Redis
 * Full key format: `${prefix}:dynamic:global`
 */
export const DYNAMIC_LIMIT_KEY_SUFFIX = ":dynamic:global";

/**
 * Default prefix for Redis keys
 */
export const DEFAULT_PREFIX = "@upstash/ratelimit";

/**
 * Minimum delay `blockUntilReady` waits before polling again, used when the
 * window reset it was given is already in the past.
 */
export const MIN_BLOCK_RETRY_DELAY = 100;
