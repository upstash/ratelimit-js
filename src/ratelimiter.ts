import { Redis } from "@upstash/redis";
import type { Duration } from "./duration";
import { ms } from "./duration";
import type { Ratelimiter, Context, RatelimitResponse } from "./types";

export type RatelimitConfig = {
	/**
   * Instance of `@upstash/redis`
   * @see https://github.com/upstash/upstash-redis#quick-start
   */
	redis: Redis,
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
	limiter: Ratelimiter,
	/**
   * All keys in redis are prefixed with this.
   *
   * @default `@upstash/ratelimit`
   */
	prefix?: string,
};

/**
 * Ratelimiter using serverless redis from https://upstash.com/
 *
 *
 * @example
 * ```ts
 * const { limit } = new Ratelimit({
 *    redis: Redis.fromEnv(),
 *    limiter: Ratelimit.tokenBucket(
 *      "30 m", // interval of 30 minutes
 *      10,     // Every 30 minutes 10 tokens are added to the bucket
 *      20      // Every bucket can hold a total of 20 tokens
 *    )
 * })
 *
 * const
 *
 * ```
 *
 */
export class Ratelimit {
	private readonly redis: Redis;
	private readonly limiter: Ratelimiter;
	private readonly prefix: string;

	/**
   * Create a new Ratelimit instance by providing a `@upstash/redis` instance and the algorithn of your choice.
   *
   *
   */

	constructor(config: RatelimitConfig) {
		this.redis = config.redis;
		this.limiter = config.limiter;
		this.prefix = config.prefix ?? "@upstash/ratelimit";
	}

	public limit = async (identifier: string): Promise<RatelimitResponse> => {
		const key = [this.prefix, identifier].join(":");
		return this.limiter({ redis: this.redis }, key);
	};

	static fixedWindow(window: Duration, tokens: number): Ratelimiter {
		const windowDuration = ms(window);

		const script = `
    
    local key = KEYS[1]
    local window = ARGV[1]
    
    local r = redis.call("INCR", key)
    if r == 1 then 
    -- The first time this key is set, the value will be 1.
    -- So we only need the expire command once
    redis.call("PEXPIRE", key, window)
    end
    
    return r
    `;

		return async function (ctx: Context, identifier: string) {
			const bucket = Math.floor(Date.now() / windowDuration);
			const key = [identifier, bucket].join(":");

			const usedTokensAfterUpdate = (
				await ctx.redis.eval(script, 1, key, windowDuration)
			) as number;

			return {
				success: usedTokensAfterUpdate <= tokens,
				limit: tokens,
				remaining: tokens - usedTokensAfterUpdate,
				reset: (bucket + 1) * windowDuration,
			};
		};
	}

	static slidingLogs(window: Duration, tokens: number): Ratelimiter {
		const script = `
    local key = KEYS[1]           -- identifier including prefixes
    local windowStart = ARGV[1]   -- timestamp of window start
    local windowEnd = ARGV[2]     -- timestamp of window end
    local tokens = ARGV[3]        -- tokens per window
    local now = ARGV[4]           -- current timestamp
    
    local count = redis.call("ZCOUNT", key, windowStart, windowEnd)
    
    if count < tonumber(tokens) then
    -- Log the current request
    redis.call("ZADD", key, now, now)
    
    -- Remove all previous requests that are outside the window
    redis.call("ZREMRANGEBYSCORE", key, "-inf", windowStart - 1)  
    
    end
    
    return count
    `;
		return async function (ctx: Context, identifier: string) {
			const windowEnd = Date.now();
			const windowStart = windowEnd - ms(window);

			const count = (
				await ctx.redis.eval(
					script,
					1,
					identifier,
					windowStart,
					windowEnd,
					tokens,
					Date.now(),
				)
			) as number;
			return {
				success: count < tokens,
				limit: tokens,
				remaining: Math.max(0, tokens - count - 1),
				reset: windowEnd,
			};
		};
	}

	static slidingWindow(window: Duration, tokens: number): Ratelimiter {
		const script = `
      local currentKey = KEYS[1]           -- identifier including prefixes
      local previousKey = KEYS[2]       -- key of the previous bucket
      local tokens = tonumber(ARGV[1])        -- tokens per window
      local now = ARGV[2]           -- current timestamp in milliseconds
      local window = ARGV[3]         -- interval in milliseconds

      local requestsInCurrentWindow = redis.call("GET", currentKey)
      if requestsInCurrentWindow == false then
        requestsInCurrentWindow = 0
      end


      local requestsInPreviousWindow = redis.call("GET", previousKey)
      if requestsInPreviousWindow == false then
        requestsInPreviousWindow = 0
      end
      local percentageInCurrent = ( now % window) / window
      if requestsInPreviousWindow * ( 1 - percentageInCurrent ) + requestsInCurrentWindow >= tokens then
        return 0
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
		return async function (ctx: Context, identifier: string) {
			const now = Date.now();

			const currentWindow = Math.floor(now / windowSize);
			const currentKey = [identifier, currentWindow].join(":");
			const previousWindow = currentWindow - windowSize;
			const previousKey = [identifier, previousWindow].join(":");

			const remaining = (
				await ctx.redis.eval(
					script,
					2,
					currentKey,
					previousKey,
					tokens,
					now,
					windowSize,
				)
			) as number;
			return {
				success: remaining > 0,
				limit: tokens,
				remaining,
				reset: (currentWindow + 1) * windowSize,
			};
		};
	}
	static tokenBucket(
		interval: Duration,
		/**
     * How many tokens are refilled per `Duration`
     *
     * An interval of `10s` and refillRate of 5 will cause a new token to be added every 2 seconds.
     */
		refillRate: number,
		/**
     * Maximum number of tokens.
     * A newly created bucket starts with this many tokens.
     */
		maxTokens: number,
	): Ratelimiter {
		if (refillRate > maxTokens) {
			throw new Error(
				`Setting the refillRate higher than maxTokens doesn't make sense and is probably a mistake.`,
			);
		}

		const script = `
        local key = KEYS[1]           -- identifier including prefixes
       
        local maxTokens = tonumber(ARGV[1])     -- maximum number of tokens
        local interval = tonumber(ARGV[2])      -- size of the window in milliseconds
        local refillRate = tonumber(ARGV[3])     -- how many tokens are refilled after each interval
        local now = tonumber(ARGV[4])           -- current timestamp in milliseconds
  
        local remaining = 0
        
  
        local bucket = redis.call("HMGET", key, "updatedAt", "tokens")
        
        if bucket[1] == false then
          -- The bucket does not exist yet, so we create it and add a ttl.
          remaining = maxTokens - 1
          
          redis.call("HMSET", key, "updatedAt", now, "tokens", remaining)
          redis.call("PEXPIRE", key, interval)
  
          return {remaining, now + interval}
        end


  
        -- The bucket does exist
  
        local updatedAt = tonumber(bucket[1])
        local tokens = tonumber(bucket[2])
  
        if now >= updatedAt + interval then
          remaining = maxTokens - 1
          
          redis.call("HMSET", key, "updatedAt", now, "tokens", remaining)
          return {remaining, now + interval}
        end
  
        if tokens > 0 then
          remaining = tokens - 1
          redis.call("HMSET", key, "updatedAt", now, "tokens", remaining)
        end
  
        return {remaining, updatedAt + interval}
       `;

		const intervalDuration = ms(interval);
		return async function (ctx: Context, identifier: string) {
			const now = Date.now();
			const key = [identifier, Math.floor(now / intervalDuration)].join(":");

			const [remaining, reset] = (
				await ctx.redis.eval(
					script,
					1,
					key,
					maxTokens,
					intervalDuration,
					refillRate,
					now,
				)
			) as [number, number];
			console.log({ maxTokens });
			return { success: remaining > 0, limit: maxTokens, remaining, reset };
		};
	}
}
