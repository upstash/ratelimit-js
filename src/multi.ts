import type { Duration } from "./duration.ts";
import { ms } from "./duration.ts";
import type { Algorithm, MultiRegionContext } from "./types.ts";
import { Ratelimit } from "./ratelimit.ts";
import { Cache } from "./cache.ts";
import type { Redis } from "./types.ts";

export type MultiRegionRatelimitConfig = {
  /**
   * Instances of `@upstash/redis`
   * @see https://github.com/upstash/upstash-redis#quick-start
   */
  redis: Redis[];
  /**
   * The ratelimiter function to use.
   *
   * Choose one of the predefined ones or implement your own.
   * Available algorithms are exposed via static methods:
   * - MultiRegionRatelimit.fixedWindow
   */
  limiter: Algorithm<MultiRegionContext>;
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
   * if the map or th ratelimit instance is created outside your serverless function handler.
   */
  ephemeralCache?: Map<string, number> | false;
};

/**
 * Ratelimiter using serverless redis from https://upstash.com/
 *
 * @example
 * ```ts
 * const { limit } = new MultiRegionRatelimit({
 *    redis: Redis.fromEnv(),
 *    limiter: MultiRegionRatelimit.fixedWindow(
 *      10,     // Allow 10 requests per window of 30 minutes
 *      "30 m", // interval of 30 minutes
 *    )
 * })
 *
 * ```
 */
export class MultiRegionRatelimit extends Ratelimit<MultiRegionContext> {
  /**
   * Create a new Ratelimit instance by providing a `@upstash/redis` instance and the algorithn of your choice.
   */
  constructor(config: MultiRegionRatelimitConfig) {
    super({
      prefix: config.prefix,
      limiter: config.limiter,
      ctx: {
        redis: config.redis,
        cache: config.ephemeralCache
          ? new Cache(config.ephemeralCache)
          : undefined,
      },
    });
  }

  /**
   * Each requests inside a fixed time increases a counter.
   * Once the counter reaches a maxmimum allowed number, all further requests are
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
  ): Algorithm<MultiRegionContext> {
    const windowDuration = ms(window);
    const script = `
    local key     = KEYS[1]
    local id      = ARGV[1]
    local window  = ARGV[2]
    
    redis.call("SADD", key, id)
    local members = redis.call("SMEMBERS", key)
    if #members == 1 then
    -- The first time this key is set, the value will be 1.
    -- So we only need the expire command once
      redis.call("PEXPIRE", key, window)
    end
    
    return members
`;

    return async function (ctx: MultiRegionContext, identifier: string) {
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

      const requestID = crypto.randomUUID();
      const bucket = Math.floor(Date.now() / windowDuration);
      const key = [identifier, bucket].join(":");

      const dbs: { redis: Redis; request: Promise<string[]> }[] = ctx.redis.map(
        (redis) => ({
          redis,
          request: redis.eval(
            script,
            [key],
            [requestID, windowDuration],
          ) as Promise<string[]>,
        }),
      );

      const firstResponse = await Promise.any(dbs.map((s) => s.request));

      const usedTokens = firstResponse.length;

      const remaining = tokens - usedTokens - 1;

      /**
       * If the length between two databases does not match, we sync the two databases
       */
      async function sync() {
        const individualIDs = await Promise.all(dbs.map((s) => s.request));
        const allIDs = Array.from(
          new Set(individualIDs.flatMap((_) => _)).values(),
        );

        for (const db of dbs) {
          const ids = await db.request;
          /**
           * If the bucket in this db is already full, it doesn't matter which ids it contains.
           * So we do not have to sync.
           */
          if (ids.length >= tokens) {
            continue;
          }
          const diff = allIDs.filter((id) => !ids.includes(id));
          /**
           * Don't waste a request if there is nothing to send
           */
          if (diff.length === 0) {
            continue;
          }

          await db.redis.sadd(key, ...allIDs);
        }
      }

      /**
       * Do not await sync. This should not run in the critical path.
       */

      const success = remaining > 0;
      const reset = (bucket + 1) * windowDuration;

      if (ctx.cache && !success) {
        ctx.cache.blockUntil(identifier, reset);
      }
      return {
        success,
        limit: tokens,
        remaining,
        reset,
        pending: sync(),
      };
    };
  }

  /**
   * Combined approach of `slidingLogs` and `fixedWindow` with lower storage
   * costs than `slidingLogs` and improved boundary behavior by calcualting a
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
  ): Algorithm<MultiRegionContext> {
    const windowSize = ms(window);
    const script = `
      local currentKey  = KEYS[1]           -- identifier including prefixes
      local previousKey = KEYS[2]           -- key of the previous bucket
      local tokens      = tonumber(ARGV[1]) -- tokens per window
      local now         = ARGV[2]           -- current timestamp in milliseconds
      local window      = ARGV[3]           -- interval in milliseconds
      local requestID   = ARGV[4]           -- uuid for this request


      local currentMembers = redis.call("SMEMBERS", currentKey)
      local requestsInCurrentWindow = #currentMembers
      local previousMembers = redis.call("SMEMBERS", previousKey)
      local requestsInPreviousWindow = #previousMembers

      local percentageInCurrent = ( now % window) / window
      if requestsInPreviousWindow * ( 1 - percentageInCurrent ) + requestsInCurrentWindow >= tokens then
        return {currentMembers, previousMembers}
      end

      redis.call("SADD", currentKey, requestID)
      table.insert(currentMembers, requestID)
      if requestsInCurrentWindow == 0 then 
        -- The first time this key is set, the value will be 1.
        -- So we only need the expire command once
        redis.call("PEXPIRE", currentKey, window * 2 + 1000) -- Enough time to overlap with a new window + 1 second
      end
      return {currentMembers, previousMembers}
      `;
    const windowDuration = ms(window);

    return async function (ctx: MultiRegionContext, identifier: string) {
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

      const requestID = crypto.randomUUID();
      const now = Date.now();

      const currentWindow = Math.floor(now / windowSize);
      const currentKey = [identifier, currentWindow].join(":");
      const previousWindow = currentWindow - windowSize;
      const previousKey = [identifier, previousWindow].join(":");

      const dbs: { redis: Redis; request: Promise<[string[], string[]]> }[] =
        ctx.redis.map((redis) => ({
          redis,
          request: redis.eval(
            script,
            [currentKey, previousKey],
            [tokens, now, windowDuration, requestID],
          ) as Promise<[string[], string[]]>,
        }));

      const percentageInCurrent = (now % windowDuration) / windowDuration;
      const [current, previous] = await Promise.any(dbs.map((s) => s.request));

      const usedTokens = previous.length * (1 - percentageInCurrent) +
        current.length;

      const remaining = tokens - usedTokens;

      /**
       * If a database differs from the consensus, we sync it
       */
      async function sync() {
        const [individualIDs] = await Promise.all(dbs.map((s) => s.request));
        const allIDs = Array.from(
          new Set(individualIDs.flatMap((_) => _)).values(),
        );

        for (const db of dbs) {
          const [ids] = await db.request;
          /**
           * If the bucket in this db is already full, it doesn't matter which ids it contains.
           * So we do not have to sync.
           */
          if (ids.length >= tokens) {
            continue;
          }
          const diff = allIDs.filter((id) => !ids.includes(id));
          /**
           * Don't waste a request if there is nothing to send
           */
          if (diff.length === 0) {
            continue;
          }

          await db.redis.sadd(currentKey, ...allIDs);
        }
      }

      const success = remaining > 0;
      const reset = (currentWindow + 1) * windowDuration;
      if (ctx.cache && !success) {
        ctx.cache.blockUntil(identifier, reset);
      }
      return {
        success,
        limit: tokens,
        remaining,
        reset,
        pending: sync(),
      };
    };
  }
}
