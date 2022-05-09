import type { Duration } from "./duration.ts";
import { ms } from "./duration.ts";
import type { Algorithm, GlobalContext } from "./types.ts";
import { Ratelimit } from "./ratelimit.ts";
import type { Redis } from "./types.ts";

export type GlobalRatelimitConfig = {
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
   * - GlobalRatelimit.fixedWindow
   */
  limiter: Algorithm<GlobalContext>;
  /**
   * All keys in redis are prefixed with this.
   *
   * @default `@upstash/ratelimit`
   */
  prefix?: string;
};

/**
 * Ratelimiter using serverless redis from https://upstash.com/
 *
 * @example
 * ```ts
 * const { limit } = new GlobalRatelimit({
 *    redis: Redis.fromEnv(),
 *    limiter: GlobalRatelimit.fixedWindow(
 *      10,     // Allow 10 requests per window of 30 minutes
 *      "30 m", // interval of 30 minutes
 *    )
 * })
 *
 * ```
 */
export class GlobalRatelimit extends Ratelimit<GlobalContext> {
  /**
   * Create a new Ratelimit instance by providing a `@upstash/redis` instance and the algorithn of your choice.
   */
  constructor(config: GlobalRatelimitConfig) {
    super({
      prefix: config.prefix,
      limiter: config.limiter,
      ctx: { redis: config.redis },
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
  ): Algorithm<GlobalContext> {
    const windowDuration = ms(window);
    const requestID = crypto.randomUUID();

    return async function (ctx: GlobalContext, identifier: string) {
      const bucket = Math.floor(Date.now() / windowDuration);
      const key = [identifier, bucket].join(":");

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

      const state: { redis: Redis; p: Promise<string[]> }[] = ctx.redis.map(
        (redis) => ({
          redis,
          p: redis.eval(script, [key], [requestID, windowDuration]) as Promise<
            string[]
          >,
        }),
      );

      const firstResponse = await Promise.any(state.map((s) => s.p));

      const usedTokens = firstResponse.length;

      const remaining = tokens - usedTokens - 1;

      /**
       * If the length between two databases does not match, we sync the two databases
       */
      async function sync() {
        const allIDs = Array.from(
          new Set(
            (await Promise.all(state.map((s) => s.p))).flatMap((_) => _),
          ).values(),
        );

        for (const s of state) {
          const ids = await s.p;
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

          await s.redis.sadd(key, ...allIDs);
        }
      }

      sync();

      return {
        success: remaining > 0,
        limit: tokens,
        remaining,
        reset: (bucket + 1) * windowDuration,
      };
    };
  }
}
