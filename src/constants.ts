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