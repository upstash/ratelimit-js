import type { createClient } from "redis";

type RedisCore = ReturnType<typeof createClient>;

export type Geo = {
  country?: string;
  city?: string;
  region?: string;
  ip?: string;
};

/**
 * EphemeralCache is used to block certain identifiers right away in case they have already exceeded the ratelimit.
 */
export type EphemeralCache = {
  isBlocked: (identifier: string) => { blocked: boolean; reset: number };
  blockUntil: (identifier: string, reset: number) => void;

  set: (key: string, value: number) => void;
  get: (key: string) => number | null;

  incr: (key: string) => number;

  pop: (key: string) => void;
  empty: () => void;

  size: () => number;
};

export type RegionContext = {
  redis: Redis;
  cache?: EphemeralCache;
};

export type RatelimitResponseType = "timeout" | "cacheBlock";

export type Context = RegionContext;
export type RatelimitResponse = {
  /**
   * Whether the request may pass(true) or exceeded the limit(false)
   */
  success: boolean;
  /**
   * Maximum number of requests allowed within a window.
   */
  limit: number;
  /**
   * How many requests the user has left within the current window.
   */
  remaining: number;
  /**
   * Unix timestamp in milliseconds when the limits are reset.
   */
  reset: number;

  /**
   * Reason behind the result in `success` field.
   * - Is set to "timeout" when request times out
   * - Is set to "cacheBlock" when an identifier is blocked through cache without calling redis because it was
   *    rate limited previously.
   * - Is set to undefined if rate limit check had to use Redis. This happens in cases when `success` field in
   *    the response is true. It can also happen the first time sucecss is false.
   */
  reason?: RatelimitResponseType;
};

export type Algorithm<TContext> = () => {
  limit: (
    ctx: TContext,
    identifier: string,
    rate?: number,
    opts?: {
      cache?: EphemeralCache;
    }
  ) => Promise<RatelimitResponse>;
  getRemaining: (
    ctx: TContext,
    identifier: string
  ) => Promise<{
    remaining: number;
    reset: number;
  }>;
  resetTokens: (ctx: TContext, identifier: string) => Promise<void>;
};

export type LimitPayload = [RatelimitResponse];
export type LimitOptions = {
  geo?: Geo;
  rate?: number;
  ip?: string;
  userAgent?: string;
  country?: string;
};

export type Redis = RedisCore;
