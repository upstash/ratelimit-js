import type { Duration } from "./duration";
import { ms } from "./duration";
import type { Algorithm, RegionContext } from "./types";
import type { Redis } from "./types";

import { Ratelimit } from "./ratelimit";
export type RegionRatelimitConfig = {
  /**
   * Instance of `@upstash/redis`
   * @see https://github.com/upstash/upstash-redis#quick-start
   */
  redis: Redis;
  /**
   * The ratelimiter function to use.
   *
   * Choose one of the predefined ones or implement your own.
   * Available algorithms are exposed via static methods:
   * - Ratelimiter.fixedWindow
   * - Ratelimiter.slidingLogs
   * - Ratelimiter.slidingWindow
   * - Ratelimiter.tokenBucket
   */
  limiter: Algorithm<RegionContext>;
  /**
   * All keys in redis are prefixed with this.
   *
   * @default `@upstash/ratelimit`
   */
  prefix?: string;

  /**
   * If enabled, the ratelimiter will keep a global cache of identifiers, that have
   * exhausted their ratelimit. In serverless environments this is only possible if
   * you create the ratelimiter instance outside of your handler function. While the
   * function is still hot, the ratelimiter can block requests without having to
   * request data from redis, thus saving time and money.
   *
   * Whenever an identifier has exceeded its limit, the ratelimiter will add it to an
   * internal list together with its reset timestamp. If the same identifier makes a
   * new request before it is reset, we can immediately reject it.
   *
   * Set to `false` to disable.
   *
   * If left undefined, a map is created automatically, but it can only work
   * if the map or the ratelimit instance is created outside your serverless function handler.
   */
  ephemeralCache?: Map<string, number> | false;

  /**
   * If set, the ratelimiter will allow requests to pass after this many milliseconds.
   *
   * Use this if you want to allow requests in case of network problems
   */
  timeout?: number;

  /**
   * If enabled, the ratelimiter will store analytics data in redis, which you can check out at
   * https://upstash.com/ratelimit
   *
   * @default true
   */
  analytics?: boolean;
};

/**
 * Ratelimiter using serverless redis from https://upstash.com/
 *
 * @example
 * ```ts
 * const { limit } = new Ratelimit({
 *    redis: Redis.fromEnv(),
 *    limiter: Ratelimit.slidingWindow(
 *      "30 m", // interval of 30 minutes
 *      10,     // Allow 10 requests per window of 30 minutes
 *    )
 * })
 *
 * ```
 */
export class RegionRatelimit extends Ratelimit<RegionContext> {
  /**
   * Create a new Ratelimit instance by providing a `@upstash/redis` instance and the algorithm of your choice.
   */

  constructor(config: RegionRatelimitConfig) {
    super({
      prefix: config.prefix,
      limiter: config.limiter,
      timeout: config.timeout,
      analytics: config.analytics,
      ctx: {
        redis: config.redis,
      },
      ephemeralCache: config.ephemeralCache,
    });
  }

  /**
   * Each request inside a fixed time increases a counter.
   * Once the counter reaches the maximum allowed number, all further requests are
   * rejected.
   *
   * **Pro:**
   *
   * - Newer requests are not starved by old ones.
   * - Low storage cost.
   *
   * **Con:**
   *
   * A burst of requests near the boundary of a window can result in a very
   * high request rate because two windows will be filled with requests quickly.
   *
   * @param tokens - How many requests a user can make in each time window.
   * @param window - A fixed timeframe
   */
  static fixedWindow(
    /**
     * How many requests are allowed per window.
     */
    tokens: number,
    /**
     * The duration in which `tokens` requests are allowed.
     */
    window: Duration,
  ): Algorithm<RegionContext> {
    const windowDuration = ms(window);

    const script = `
    local key     = KEYS[1]
    local window  = ARGV[1]
    
    local r = redis.call("INCR", key)
    if r == 1 then 
    -- The first time this key is set, the value will be 1.
    -- So we only need the expire command once
    redis.call("PEXPIRE", key, window)
    end
    
    return r
    `;

    return async function (ctx: RegionContext, identifier: string) {
      const bucket = Math.floor(Date.now() / windowDuration);
      const key = [identifier, bucket].join(":");

      if (ctx.cache) {
        const { blocked, reset } = ctx.cache.isBlocked(identifier);
        if (blocked) {
          return {
            success: false,
            limit: tokens,
            remaining: 0,
            reset: reset,
            pending: Promise.resolve(),
          };
        }
      }
      const usedTokensAfterUpdate = (await ctx.redis.eval(script, [key], [windowDuration])) as number;

      const success = usedTokensAfterUpdate <= tokens;
      const reset = (bucket + 1) * windowDuration;
      if (ctx.cache && !success) {
        ctx.cache.blockUntil(identifier, reset);
      }

      return {
        success,
        limit: tokens,
        remaining: tokens - usedTokensAfterUpdate,
        reset,
        pending: Promise.resolve(),
      };
    };
  }

  /**
   * Combined approach of `slidingLogs` and `fixedWindow` with lower storage
   * costs than `slidingLogs` and improved boundary behavior by calculating a
   * weighted score between two windows.
   *
   * **Pro:**
   *
   * Good performance allows this to scale to very high loads.
   *
   * **Con:**
   *
   * Nothing major.
   *
   * @param tokens - How many requests a user can make in each time window.
   * @param window - The duration in which the user can max X requests.
   */
  static slidingWindow(
    /**
     * How many requests are allowed per window.
     */
    tokens: number,
    /**
     * The duration in which `tokens` requests are allowed.
     */
    window: Duration,
  ): Algorithm<RegionContext> {
    const script = `
      local currentKey  = KEYS[1]           -- identifier including prefixes
      local previousKey = KEYS[2]           -- key of the previous bucket
      local tokens      = tonumber(ARGV[1]) -- tokens per window
      local now         = ARGV[2]           -- current timestamp in milliseconds
      local window      = ARGV[3]           -- interval in milliseconds

      local requestsInCurrentWindow = redis.call("GET", currentKey)
      if requestsInCurrentWindow == false then
        requestsInCurrentWindow = -1
      end


      local requestsInPreviousWindow = redis.call("GET", previousKey)
      if requestsInPreviousWindow == false then
        requestsInPreviousWindow = 0
      end
      local percentageInCurrent = ( now % window) / window
      if requestsInPreviousWindow * ( 1 - percentageInCurrent ) + requestsInCurrentWindow >= tokens then
        return -1
      end

      local newValue = redis.call("INCR", currentKey)
      if newValue == 1 then 
        -- The first time this key is set, the value will be 1.
        -- So we only need the expire command once
        redis.call("PEXPIRE", currentKey, window * 2 + 1000) -- Enough time to overlap with a new window + 1 second
      end
      return tokens - newValue
      `;
    const windowSize = ms(window);
    return async function (ctx: RegionContext, identifier: string) {
      const now = Date.now();

      const currentWindow = Math.floor(now / windowSize);
      const currentKey = [identifier, currentWindow].join(":");
      const previousWindow = currentWindow - windowSize;
      const previousKey = [identifier, previousWindow].join(":");

      if (ctx.cache) {
        const { blocked, reset } = ctx.cache.isBlocked(identifier);
        if (blocked) {
          return {
            success: false,
            limit: tokens,
            remaining: 0,
            reset: reset,
            pending: Promise.resolve(),
          };
        }
      }

      const remaining = (await ctx.redis.eval(script, [currentKey, previousKey], [tokens, now, windowSize])) as number;

      const success = remaining >= 0;
      const reset = (currentWindow + 1) * windowSize;
      if (ctx.cache && !success) {
        ctx.cache.blockUntil(identifier, reset);
      }
      return {
        success,
        limit: tokens,
        remaining: Math.max(0, remaining),
        reset,
        pending: Promise.resolve(),
      };
    };
  }

  /**
   * You have a bucket filled with `{maxTokens}` tokens that refills constantly
   * at `{refillRate}` per `{interval}`.
   * Every request will remove one token from the bucket and if there is no
   * token to take, the request is rejected.
   *
   * **Pro:**
   *
   * - Bursts of requests are smoothed out and you can process them at a constant
   * rate.
   * - Allows to set a higher initial burst limit by setting `maxTokens` higher
   * than `refillRate`
   */
  static tokenBucket(
    /**
     * How many tokens are refilled per `interval`
     *
     * An interval of `10s` and refillRate of 5 will cause a new token to be added every 2 seconds.
     */
    refillRate: number,
    /**
     * The interval for the `refillRate`
     */
    interval: Duration,
    /**
     * Maximum number of tokens.
     * A newly created bucket starts with this many tokens.
     * Useful to allow higher burst limits.
     */
    maxTokens: number,
  ): Algorithm<RegionContext> {
    const script = `
        local key         = KEYS[1]           -- identifier including prefixes
        local maxTokens   = tonumber(ARGV[1]) -- maximum number of tokens
        local interval    = tonumber(ARGV[2]) -- size of the window in milliseconds
        local refillRate  = tonumber(ARGV[3]) -- how many tokens are refilled after each interval
        local now         = tonumber(ARGV[4]) -- current timestamp in milliseconds
        
        local bucket = redis.call("HMGET", key, "refilledAt", "tokens")
        
        local refilledAt
        local tokens

        if bucket[1] == false then
          refilledAt = now
          tokens = maxTokens
        else
          refilledAt = tonumber(bucket[1])
          tokens = tonumber(bucket[2])
        end

        if now >= refilledAt + interval then
          local numRefills = math.floor((now - refilledAt) / interval)
          tokens = math.min(maxTokens, tokens + numRefills * refillRate)

          refilledAt = refilledAt + numRefills * interval
        end

      if tokens == 0 then
        return {-1, refilledAt + interval}
      end
      
      local remaining = tokens - 1
      redis.call("HSET", key, "refilledAt", refilledAt, "tokens", remaining)

      local expireAt = math.ceil(((maxTokens - remaining) / refillRate)) * interval
      redis.call("PEXPIRE", key, expireAt)

      return {remaining, refilledAt + interval}
       `;

    const intervalDuration = ms(interval);
    return async function (ctx: RegionContext, identifier: string) {
      if (ctx.cache) {
        const { blocked, reset } = ctx.cache.isBlocked(identifier);
        if (blocked) {
          return {
            success: false,
            limit: maxTokens,
            remaining: 0,
            reset: reset,
            pending: Promise.resolve(),
          };
        }
      }

      const now = Date.now();
      const key = identifier;

      const [remaining, reset] = (await ctx.redis.eval(
        script,
        [key],
        [maxTokens, intervalDuration, refillRate, now],
      )) as [number, number];

      const success = remaining > 0;
      if (ctx.cache && !success) {
        ctx.cache.blockUntil(identifier, reset);
      }

      return {
        success,
        limit: maxTokens,
        remaining,
        reset,
        pending: Promise.resolve(),
      };
    };
  }

  /**
   * cachedFixedWindow first uses the local cache to decide if a request may pass and then updates
   * it asynchronously.
   * This is experimental and not yet recommended for production use.
   *
   * @experimental
   *
   * Each request inside a fixed time increases a counter.
   * Once the counter reaches the maximum allowed number, all further requests are
   * rejected.
   *
   * **Pro:**
   *
   * - Newer requests are not starved by old ones.
   * - Low storage cost.
   *
   * **Con:**
   *
   * A burst of requests near the boundary of a window can result in a very
   * high request rate because two windows will be filled with requests quickly.
   *
   * @param tokens - How many requests a user can make in each time window.
   * @param window - A fixed timeframe
   */
  static cachedFixedWindow(
    /**
     * How many requests are allowed per window.
     */
    tokens: number,
    /**
     * The duration in which `tokens` requests are allowed.
     */
    window: Duration,
  ): Algorithm<RegionContext> {
    const windowDuration = ms(window);

    const script = `
      local key     = KEYS[1]
      local window  = ARGV[1]
      
      local r = redis.call("INCR", key)
      if r == 1 then 
      -- The first time this key is set, the value will be 1.
      -- So we only need the expire command once
      redis.call("PEXPIRE", key, window)
      end
      
      return r
      `;

    return async function (ctx: RegionContext, identifier: string) {
      if (!ctx.cache) {
        throw new Error("This algorithm requires a cache");
      }
      const bucket = Math.floor(Date.now() / windowDuration);
      const key = [identifier, bucket].join(":");
      const reset = (bucket + 1) * windowDuration;

      const hit = typeof ctx.cache.get(key) === "number";
      if (hit) {
        const cachedTokensAfterUpdate = ctx.cache.incr(key);
        const success = cachedTokensAfterUpdate < tokens;

        const pending = success
          ? ctx.redis.eval(script, [key], [windowDuration]).then((t) => {
              ctx.cache!.set(key, t as number);
            })
          : Promise.resolve();

        return {
          success,
          limit: tokens,
          remaining: tokens - cachedTokensAfterUpdate,
          reset: reset,
          pending,
        };
      }

      const usedTokensAfterUpdate = (await ctx.redis.eval(script, [key], [windowDuration])) as number;
      ctx.cache.set(key, usedTokensAfterUpdate);
      const remaining = tokens - usedTokensAfterUpdate;

      return {
        success: remaining >= 0,
        limit: tokens,
        remaining,
        reset: reset,
        pending: Promise.resolve(),
      };
    };
  }
}
